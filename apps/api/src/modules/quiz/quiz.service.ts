import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LessonType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { DefineQuizDto, SubmitQuizDto } from './dto/quiz.dto';

/** Seuil de réussite (PRD : progression intelligente). */
export const QUIZ_PASS_THRESHOLD_PERCENT = 70;

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  // ─────────────────────────── Édition (formateur/admin) ───────────────────────────

  /** Quiz complet avec réponses — contexte de confiance uniquement. */
  async getQuizForEditor(user: AuthenticatedUser, lessonId: string) {
    const lesson = await this.getOwnedQuizLesson(user, lessonId);
    const questions = await this.prisma.quizQuestion.findMany({
      where: { lessonId: lesson.id },
      orderBy: { position: 'asc' },
      include: { choices: { orderBy: { position: 'asc' } } },
    });
    return { lessonId: lesson.id, questions };
  }

  /**
   * Remplacement transactionnel de tout le quiz : plus simple et plus sûr
   * qu'une édition différentielle (pas d'états intermédiaires incohérents).
   */
  async defineQuiz(user: AuthenticatedUser, lessonId: string, dto: DefineQuizDto) {
    const lesson = await this.getOwnedQuizLesson(user, lessonId);

    for (const [i, q] of dto.questions.entries()) {
      const correctCount = q.choices.filter((c) => c.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException(
          `Question ${i + 1} : exactement une bonne réponse est requise (${correctCount} trouvée(s))`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quizQuestion.deleteMany({ where: { lessonId: lesson.id } });
      for (const [qi, q] of dto.questions.entries()) {
        await tx.quizQuestion.create({
          data: {
            lessonId: lesson.id,
            text: q.text,
            position: qi + 1,
            choices: {
              create: q.choices.map((c, ci) => ({
                text: c.text,
                isCorrect: c.isCorrect,
                position: ci + 1,
              })),
            },
          },
        });
      }
    });

    return this.getQuizForEditor(user, lessonId);
  }

  // ─────────────────────────── Passage (apprenant) ───────────────────────────

  /** Questions et choix SANS les réponses : la correction reste côté serveur. */
  async getQuizForLearner(userId: string, lessonId: string) {
    const lesson = await this.getAccessibleQuizLesson(userId, lessonId);

    const questions = await this.prisma.quizQuestion.findMany({
      where: { lessonId: lesson.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        text: true,
        position: true,
        choices: {
          orderBy: { position: 'asc' },
          select: { id: true, text: true, position: true }, // isCorrect exclu
        },
      },
    });
    if (questions.length === 0) {
      throw new NotFoundException("Ce quiz n'est pas encore disponible");
    }

    const lastAttempt = await this.prisma.quizAttempt.findFirst({
      where: { userId, lessonId: lesson.id },
      orderBy: { createdAt: 'desc' },
      select: { scorePercent: true, passed: true, createdAt: true },
    });

    return {
      lessonId: lesson.id,
      passThresholdPercent: QUIZ_PASS_THRESHOLD_PERCENT,
      questions,
      lastAttempt,
    };
  }

  async submitQuiz(userId: string, lessonId: string, dto: SubmitQuizDto) {
    const lesson = await this.getAccessibleQuizLesson(userId, lessonId);

    const questions = await this.prisma.quizQuestion.findMany({
      where: { lessonId: lesson.id },
      include: { choices: true },
    });
    if (questions.length === 0) {
      throw new NotFoundException("Ce quiz n'est pas encore disponible");
    }

    const answerByQuestion = new Map(dto.answers.map((a) => [a.questionId, a.choiceId]));
    if (answerByQuestion.size !== questions.length) {
      throw new BadRequestException(
        `Répondez à toutes les questions (${questions.length} attendues, ${answerByQuestion.size} reçues)`,
      );
    }

    let correct = 0;
    const corrections: { questionId: string; correctChoiceId: string; wasCorrect: boolean }[] = [];
    for (const q of questions) {
      const chosen = answerByQuestion.get(q.id);
      if (chosen === undefined) {
        throw new BadRequestException('Réponse manquante pour une question du quiz');
      }
      if (!q.choices.some((c) => c.id === chosen)) {
        throw new BadRequestException('Choix invalide pour une question du quiz');
      }
      const correctChoice = q.choices.find((c) => c.isCorrect)!;
      const wasCorrect = chosen === correctChoice.id;
      if (wasCorrect) correct++;
      corrections.push({ questionId: q.id, correctChoiceId: correctChoice.id, wasCorrect });
    }

    const scorePercent = Math.round((correct / questions.length) * 100);
    const passed = scorePercent >= QUIZ_PASS_THRESHOLD_PERCENT;

    await this.prisma.quizAttempt.create({
      data: {
        userId,
        lessonId: lesson.id,
        scorePercent,
        passed,
        answers: dto.answers as unknown as Prisma.InputJsonValue,
      },
    });

    if (passed) {
      // Le quiz réussi complète la leçon (comme une vidéo terminée)
      await this.prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        create: { userId, lessonId: lesson.id, completedAt: new Date() },
        update: { completedAt: new Date() },
      });
    }

    // La correction détaillée n'est renvoyée qu'après réussite : on n'offre
    // pas la grille des bonnes réponses à celui qui échoue et recommence.
    return {
      scorePercent,
      passed,
      passThresholdPercent: QUIZ_PASS_THRESHOLD_PERCENT,
      correctCount: correct,
      totalQuestions: questions.length,
      corrections: passed ? corrections : undefined,
    };
  }

  // ─────────────────────────── privé ───────────────────────────

  private async getOwnedQuizLesson(user: AuthenticatedUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { module: { include: { course: true } } } } },
    });
    if (!lesson) throw new NotFoundException('Leçon introuvable');
    if (lesson.type !== LessonType.QUIZ) {
      throw new BadRequestException("Cette leçon n'est pas un quiz");
    }
    const course = lesson.chapter.module.course;
    if (user.role !== UserRole.ADMIN && course.instructorId !== user.id) {
      throw new ForbiddenException('Cette formation ne vous appartient pas');
    }
    return lesson;
  }

  private async getAccessibleQuizLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { module: true } } },
    });
    if (!lesson || lesson.type !== LessonType.QUIZ) {
      throw new NotFoundException('Quiz introuvable');
    }
    const hasAccess = await this.enrollments.hasActiveAccess(
      userId,
      lesson.chapter.module.courseId,
    );
    if (!hasAccess) {
      throw new ForbiddenException("Vous n'avez pas accès à cette formation");
    }
    return lesson;
  }
}
