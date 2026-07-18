import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

/**
 * Délivrance des certificats de complétion (PRD §13, fin du parcours).
 * Règles :
 *  - un certificat n'est délivré que si TOUTES les leçons sont complétées ;
 *  - un seul certificat par (apprenant, formation) — claim idempotent ;
 *  - chaque certificat porte un code public vérifiable (anti-fraude).
 */
@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  async claim(userId: string, courseId: string) {
    const hasAccess = await this.enrollments.hasActiveAccess(userId, courseId);
    if (!hasAccess) {
      throw new ForbiddenException("Vous n'avez pas accès à cette formation");
    }

    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { course: { select: { title: true } } },
    });
    if (existing) return this.toDto(existing); // idempotent

    const [totalLessons, completedLessons] = await Promise.all([
      this.prisma.lesson.count({ where: { chapter: { module: { courseId } } } }),
      this.prisma.lessonProgress.count({
        where: {
          userId,
          completedAt: { not: null },
          lesson: { chapter: { module: { courseId } } },
        },
      }),
    ]);

    if (totalLessons === 0 || completedLessons < totalLessons) {
      throw new ConflictException(
        `Formation non terminée : ${completedLessons}/${totalLessons} leçons complétées`,
      );
    }

    const certificate = await this.prisma.certificate.create({
      data: { userId, courseId, code: this.generateCode() },
      include: { course: { select: { title: true } } },
    });
    return this.toDto(certificate);
  }

  async listMine(userId: string) {
    const certificates = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      include: { course: { select: { title: true, slug: true } } },
    });
    return certificates.map((c) => this.toDto(c));
  }

  /** Détail d'un de MES certificats (page imprimable). */
  async getMineByCode(userId: string, code: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code },
      include: {
        course: { select: { title: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!certificate || certificate.userId !== userId) {
      throw new NotFoundException('Certificat introuvable');
    }
    return {
      ...this.toDto(certificate),
      learnerName: `${certificate.user.firstName} ${certificate.user.lastName}`.trim(),
    };
  }

  /**
   * Vérification PUBLIQUE par code : un employeur peut confirmer l'authenticité
   * sans compte. On n'expose que le strict nécessaire.
   */
  async verify(code: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        course: { select: { title: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!certificate) return { valid: false as const };
    return {
      valid: true as const,
      code: certificate.code,
      learnerName: `${certificate.user.firstName} ${certificate.user.lastName}`.trim(),
      courseTitle: certificate.course.title,
      issuedAt: certificate.issuedAt,
    };
  }

  // ─────────────────────────── privé ───────────────────────────

  /** Ex. FDL-2026-3F8A2C9B1D — lisible, unique, non devinable. */
  private generateCode(): string {
    const random = randomBytes(5).toString('hex').toUpperCase();
    return `FDL-${new Date().getFullYear()}-${random}`;
  }

  private toDto(c: {
    id: string;
    code: string;
    courseId: string;
    issuedAt: Date;
    course: { title: string; slug?: string };
  }) {
    return {
      id: c.id,
      code: c.code,
      courseId: c.courseId,
      courseTitle: c.course.title,
      courseSlug: c.course.slug,
      issuedAt: c.issuedAt,
    };
  }
}
