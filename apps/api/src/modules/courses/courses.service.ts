import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  /** Formations de l'apprenant avec progression agrégée. */
  async listMyCourses(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        course: { status: CourseStatus.PUBLISHED },
      },
      include: {
        course: {
          include: {
            modules: {
              include: { chapters: { include: { lessons: { select: { id: true } } } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const courseIds = enrollments.map((e) => e.courseId);
    const completed = await this.prisma.lessonProgress.findMany({
      where: {
        userId,
        completedAt: { not: null },
        lesson: { chapter: { module: { courseId: { in: courseIds } } } },
      },
      select: { lesson: { select: { chapter: { select: { module: { select: { courseId: true } } } } } } },
    });

    const completedByCourse = new Map<string, number>();
    for (const p of completed) {
      const courseId = p.lesson.chapter.module.courseId;
      completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
    }

    return enrollments.map((e) => {
      const totalLessons = e.course.modules
        .flatMap((m) => m.chapters)
        .reduce((sum, c) => sum + c.lessons.length, 0);
      const completedLessons = completedByCourse.get(e.courseId) ?? 0;
      return {
        id: e.course.id,
        slug: e.course.slug,
        title: e.course.title,
        description: e.course.description,
        coverUrl: e.course.coverUrl,
        totalLessons,
        completedLessons,
        progressPercent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
        enrolledAt: e.createdAt,
      };
    });
  }

  /** Détail d'une formation (plan complet + progression), accès vérifié. */
  async getCourseForLearner(userId: string, slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: {
            chapters: {
              orderBy: { position: 'asc' },
              include: {
                lessons: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    position: true,
                    durationSeconds: true,
                    isFreePreview: true,
                    // streamVideoId volontairement exclu : jamais exposé au client
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course || course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Formation introuvable');
    }

    const hasAccess = await this.enrollments.hasActiveAccess(userId, course.id);
    if (!hasAccess) {
      throw new ForbiddenException("Vous n'avez pas accès à cette formation");
    }

    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, lesson: { chapter: { module: { courseId: course.id } } } },
    });
    const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      coverUrl: course.coverUrl,
      modules: course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        chapters: m.chapters.map((c) => ({
          id: c.id,
          title: c.title,
          position: c.position,
          lessons: c.lessons.map((l) => ({
            ...l,
            completed: !!progressByLesson.get(l.id)?.completedAt,
            lastPositionSeconds: progressByLesson.get(l.id)?.lastPositionSeconds ?? 0,
          })),
        })),
      })),
    };
  }

  /** Sauvegarde de progression (reprise automatique + complétion). */
  async saveProgress(
    userId: string,
    lessonId: string,
    input: { positionSeconds: number; completed?: boolean },
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { module: true } } },
    });
    if (!lesson) throw new NotFoundException('Leçon introuvable');

    const hasAccess = await this.enrollments.hasActiveAccess(userId, lesson.chapter.module.courseId);
    if (!hasAccess) throw new ForbiddenException("Vous n'avez pas accès à cette formation");

    return this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        lastPositionSeconds: Math.max(0, input.positionSeconds),
        completedAt: input.completed ? new Date() : null,
      },
      update: {
        lastPositionSeconds: Math.max(0, input.positionSeconds),
        // La complétion ne se perd pas si on revisionne la leçon
        ...(input.completed ? { completedAt: new Date() } : {}),
      },
    });
  }
}
