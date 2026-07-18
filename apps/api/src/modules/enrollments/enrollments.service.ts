import { Injectable } from '@nestjs/common';
import { Enrollment, EnrollmentSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Source de vérité unique du contrôle d'accès aux formations.
 * Tout module (vidéo, cours, certificats…) doit passer par hasActiveAccess —
 * jamais par sa propre requête — pour que la révocation soit systémique.
 */
@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent : ne crée pas de doublon, réactive un accès révoqué si besoin. */
  async grantAccess(
    userId: string,
    courseId: string,
    source: EnrollmentSource,
  ): Promise<{ enrollment: Enrollment; wasNew: boolean }> {
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existing) {
      if (existing.revokedAt) {
        const enrollment = await this.prisma.enrollment.update({
          where: { id: existing.id },
          data: { revokedAt: null, source },
        });
        return { enrollment, wasNew: true }; // ré-achat après révocation
      }
      return { enrollment: existing, wasNew: false };
    }

    const enrollment = await this.prisma.enrollment.create({
      data: { userId, courseId, source },
    });
    return { enrollment, wasNew: true };
  }

  /** Révocation (remboursement, litige) — l'historique est conservé. */
  async revokeAccess(userId: string, courseId: string): Promise<void> {
    await this.prisma.enrollment.updateMany({
      where: { userId, courseId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async hasActiveAccess(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.revokedAt) return false;
    if (enrollment.expiresAt && enrollment.expiresAt < new Date()) return false;
    return true;
  }
}
