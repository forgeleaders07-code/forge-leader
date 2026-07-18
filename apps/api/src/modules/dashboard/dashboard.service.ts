import { Injectable } from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardBadge {
  id: string;
  label: string;
  earned: boolean;
}

/**
 * Statistiques du dashboard apprenant (Vol 2 §13) — tout est CALCULÉ à partir
 * des données existantes (progression, quiz, certificats) : aucune table
 * dédiée, donc aucune dérive possible entre stats et réalité.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string) {
    // Formations actives de l'apprenant
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        course: { status: CourseStatus.PUBLISHED },
      },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);

    const [totalLessons, completedProgress, quizPassedCount, certificatesCount] =
      await Promise.all([
        this.prisma.lesson.count({
          where: { chapter: { module: { courseId: { in: courseIds } } } },
        }),
        this.prisma.lessonProgress.findMany({
          where: {
            userId,
            completedAt: { not: null },
            lesson: { chapter: { module: { courseId: { in: courseIds } } } },
          },
          select: {
            lesson: { select: { durationSeconds: true } },
          },
        }),
        this.prisma.quizAttempt.count({ where: { userId, passed: true } }),
        this.prisma.certificate.count({ where: { userId } }),
      ]);

    const completedLessons = completedProgress.length;
    const studySeconds = completedProgress.reduce(
      (sum, p) => sum + (p.lesson.durationSeconds ?? 0),
      0,
    );

    const streakDays = await this.computeStreak(userId);
    const continueCourse = await this.findContinueCourse(userId, courseIds);

    const badges: DashboardBadge[] = [
      { id: 'first-lesson', label: 'Première leçon terminée', earned: completedLessons >= 1 },
      { id: 'quiz-passed', label: 'Premier quiz réussi', earned: quizPassedCount >= 1 },
      { id: 'first-certificate', label: 'Première formation certifiée', earned: certificatesCount >= 1 },
      { id: 'streak-3', label: '3 jours d\'affilée', earned: streakDays >= 3 },
      { id: 'streak-7', label: '7 jours d\'affilée', earned: streakDays >= 7 },
    ];

    return {
      globalProgressPercent:
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
      completedLessons,
      totalLessons,
      studySeconds,
      streakDays,
      certificatesCount,
      quizPassedCount,
      badges,
      continueCourse,
    };
  }

  // ─────────────────────────── privé ───────────────────────────

  /**
   * Streak = nombre de jours consécutifs avec activité (progression ou quiz),
   * en remontant depuis aujourd'hui (ou hier, pour ne pas casser la série
   * avant la première activité du jour).
   */
  private async computeStreak(userId: string): Promise<number> {
    const [progressDates, attemptDates] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 400,
      }),
      this.prisma.quizAttempt.findMany({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
    ]);

    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const activeDays = new Set<string>([
      ...progressDates.map((p) => dayKey(p.updatedAt)),
      ...attemptDates.map((a) => dayKey(a.createdAt)),
    ]);
    if (activeDays.size === 0) return 0;

    let streak = 0;
    const cursor = new Date();
    // La série peut commencer hier si rien n'a encore été fait aujourd'hui
    if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

    while (activeDays.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  /** Formation à reprendre : celle de la dernière activité, sinon la plus récente. */
  private async findContinueCourse(userId: string, courseIds: string[]) {
    if (courseIds.length === 0) return null;

    const lastProgress = await this.prisma.lessonProgress.findFirst({
      where: { userId, lesson: { chapter: { module: { courseId: { in: courseIds } } } } },
      orderBy: { updatedAt: 'desc' },
      select: {
        lesson: {
          select: { chapter: { select: { module: { select: { courseId: true } } } } },
        },
      },
    });

    const courseId = lastProgress?.lesson.chapter.module.courseId ?? courseIds[0];

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: {
            chapters: {
              orderBy: { position: 'asc' },
              include: {
                lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });
    if (!course) return null;

    const lessons = course.modules.flatMap((m) => m.chapters.flatMap((c) => c.lessons));
    const completed = await this.prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lessonId: { in: lessons.map((l) => l.id) } },
      select: { lessonId: true },
    });
    const completedIds = new Set(completed.map((c) => c.lessonId));
    const nextLesson = lessons.find((l) => !completedIds.has(l.id));

    return {
      slug: course.slug,
      title: course.title,
      coverUrl: course.coverUrl,
      progressPercent:
        lessons.length === 0 ? 0 : Math.round((completedIds.size / lessons.length) * 100),
      nextLessonTitle: nextLesson?.title ?? null,
      isCompleted: lessons.length > 0 && completedIds.size === lessons.length,
    };
  }
}
