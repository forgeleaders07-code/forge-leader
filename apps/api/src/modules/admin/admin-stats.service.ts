import { Injectable } from '@nestjs/common';
import { CourseStatus, LessonType, UserRole, WebhookStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Statistiques de pilotage (Vol 2 §14-15).
 * INSTRUCTOR : uniquement ses formations. ADMIN : tout + totaux plateforme.
 * Tout est calculé depuis les données réelles, comme le dashboard apprenant.
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(user: AuthenticatedUser) {
    const courseWhere = user.role === UserRole.ADMIN ? {} : { instructorId: user.id };

    const courses = await this.prisma.course.findMany({
      where: courseWhere,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, slug: true, title: true, status: true },
    });
    const courseIds = courses.map((c) => c.id);

    const courseStats = await Promise.all(courseIds.map((id) => this.statsForCourse(id)));
    const byCourse = new Map(courseIds.map((id, i) => [id, courseStats[i]]));

    // Étudiants distincts sur le périmètre
    const distinctStudents = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, revokedAt: null },
      distinct: ['userId'],
      select: { userId: true },
    });

    const courseRows = courses.map((c) => ({ ...c, ...byCourse.get(c.id)! }));
    const enrolledRows = courseRows.filter((c) => c.activeEnrollments > 0);

    return {
      totals: {
        courses: courses.length,
        publishedCourses: courses.filter((c) => c.status === CourseStatus.PUBLISHED).length,
        students: distinctStudents.length,
        averageProgressPercent:
          enrolledRows.length === 0
            ? 0
            : Math.round(
                enrolledRows.reduce((sum, c) => sum + c.avgProgressPercent, 0) /
                  enrolledRows.length,
              ),
        certificates: courseRows.reduce((sum, c) => sum + c.certificatesCount, 0),
      },
      courses: courseRows,
      platform: user.role === UserRole.ADMIN ? await this.platformStats() : null,
    };
  }

  // ─────────────────────────── privé ───────────────────────────

  private async statsForCourse(courseId: string) {
    const [totalLessons, enrollments, certificatesCount] = await Promise.all([
      this.prisma.lesson.count({ where: { chapter: { module: { courseId } } } }),
      this.prisma.enrollment.findMany({
        where: { courseId, revokedAt: null },
        select: { userId: true },
      }),
      this.prisma.certificate.count({ where: { courseId } }),
    ]);

    const userIds = enrollments.map((e) => e.userId);
    let avgProgressPercent = 0;
    let completedStudents = 0;

    if (userIds.length > 0 && totalLessons > 0) {
      const completions = await this.prisma.lessonProgress.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          completedAt: { not: null },
          lesson: { chapter: { module: { courseId } } },
        },
        _count: { _all: true },
      });
      const byUser = new Map(completions.map((c) => [c.userId, c._count._all]));
      const progressSum = userIds.reduce(
        (sum, id) => sum + Math.min(1, (byUser.get(id) ?? 0) / totalLessons),
        0,
      );
      avgProgressPercent = Math.round((progressSum / userIds.length) * 100);
      completedStudents = userIds.filter((id) => (byUser.get(id) ?? 0) >= totalLessons).length;
    }

    return {
      totalLessons,
      activeEnrollments: userIds.length,
      avgProgressPercent,
      completionRatePercent:
        userIds.length === 0 ? 0 : Math.round((completedStudents / userIds.length) * 100),
      certificatesCount,
    };
  }

  /** Totaux plateforme — réservés à l'ADMIN (Vol 2 §15). */
  private async platformStats() {
    const [
      totalUsers,
      pendingUsers,
      videoLessons,
      failedWebhooks,
      processedWebhooks,
      recentEnrollments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'PENDING_ACTIVATION' } }),
      this.prisma.lesson.count({ where: { type: LessonType.VIDEO } }),
      this.prisma.webhookEvent.count({ where: { status: WebhookStatus.FAILED } }),
      this.prisma.webhookEvent.count({ where: { status: WebhookStatus.PROCESSED } }),
      this.prisma.enrollment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          course: { select: { title: true } },
        },
      }),
    ]);

    return {
      totalUsers,
      pendingUsers,
      videoLessons,
      webhooks: { processed: processedWebhooks, failed: failedWebhooks },
      recentEnrollments: recentEnrollments.map((e) => ({
        email: e.user.email,
        name: `${e.user.firstName} ${e.user.lastName}`.trim(),
        courseTitle: e.course.title,
        source: e.source,
        createdAt: e.createdAt,
        revoked: !!e.revokedAt,
      })),
    };
  }
}
