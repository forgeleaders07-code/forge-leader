import { Injectable, Logger } from '@nestjs/common';
import { EnrollmentSource, Prisma, WebhookStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

/**
 * Traitement des événements d'achat Systeme.io.
 *
 * Parcours nominal (PRD §13) :
 *   achat → webhook → compte créé (ou retrouvé) → accès attribué → email envoyé.
 *
 * Garanties :
 *  - Idempotence : un événement (provider, externalId) n'est traité qu'une fois,
 *    même si Systeme.io le rejoue.
 *  - Traçabilité : chaque événement est journalisé avec son statut et son erreur
 *    éventuelle (table webhook_events) pour audit et rejeu manuel.
 */
@Injectable()
export class SystemeIoWebhookService {
  private readonly logger = new Logger(SystemeIoWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly enrollments: EnrollmentsService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}

  async process(payload: Record<string, unknown>): Promise<string> {
    const parsed = this.parsePayload(payload);

    // Journalisation idempotente : si l'événement existe déjà, on s'arrête là.
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: 'systeme.io',
          externalId: parsed.externalId,
          eventType: parsed.eventType,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        this.logger.log(`Événement déjà reçu, ignoré : ${parsed.externalId}`);
        return 'duplicate';
      }
      throw e;
    }

    try {
      const status = await this.handleEvent(parsed);
      await this.markEvent(parsed.externalId, status);
      return status.toLowerCase();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec de traitement ${parsed.externalId} : ${message}`);
      await this.markEvent(parsed.externalId, WebhookStatus.FAILED, message);
      // On renvoie quand même 200 : l'événement est journalisé, le rejeu sera interne.
      return 'failed';
    }
  }

  // ─────────────────────────── privé ───────────────────────────

  private async handleEvent(event: ParsedEvent): Promise<WebhookStatus> {
    if (event.eventType !== 'sale.completed' && event.eventType !== 'order.paid') {
      return WebhookStatus.IGNORED;
    }

    // Mapping produit Systeme.io → formation
    const course = await this.prisma.course.findFirst({
      where: { externalProductIds: { has: event.productId } },
    });
    if (!course) {
      this.logger.warn(`Produit inconnu : ${event.productId} — événement ignoré`);
      return WebhookStatus.IGNORED;
    }

    const { user, created } = await this.users.findOrCreateProvisioned({
      email: event.customerEmail,
      firstName: event.firstName,
      lastName: event.lastName,
    });

    const { wasNew } = await this.enrollments.grantAccess(
      user.id,
      course.id,
      EnrollmentSource.SYSTEME_IO_WEBHOOK,
    );

    if (created) {
      const activationToken = await this.auth.createActivationToken(user.id);
      await this.mail.sendWelcomeEmail({
        to: user.email,
        firstName: user.firstName,
        courseTitle: course.title,
        userId: user.id,
        activationToken,
      });
    } else if (wasNew) {
      await this.mail.sendCourseAddedEmail({
        to: user.email,
        firstName: user.firstName,
        courseTitle: course.title,
      });
    }

    return WebhookStatus.PROCESSED;
  }

  private parsePayload(payload: Record<string, unknown>): ParsedEvent {
    // Structure Systeme.io : on lit défensivement les champs attendus.
    const data = (payload['data'] ?? payload) as Record<string, unknown>;
    const customer = (data['customer'] ?? {}) as Record<string, unknown>;
    const product = (data['product'] ?? {}) as Record<string, unknown>;

    const externalId = String(payload['id'] ?? data['id'] ?? '');
    const eventType = String(payload['type'] ?? payload['event'] ?? 'unknown');
    const customerEmail = String(customer['email'] ?? data['customer_email'] ?? '').toLowerCase();
    const productId = String(product['id'] ?? data['product_id'] ?? '');

    if (!externalId || !customerEmail || !productId) {
      throw new Error(
        `Payload incomplet (id=${externalId || '∅'}, email=${customerEmail || '∅'}, produit=${productId || '∅'})`,
      );
    }

    return {
      externalId,
      eventType,
      customerEmail,
      productId,
      firstName: String(customer['first_name'] ?? data['first_name'] ?? 'Apprenant'),
      lastName: String(customer['last_name'] ?? data['last_name'] ?? ''),
    };
  }

  private async markEvent(externalId: string, status: WebhookStatus, error?: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { provider_externalId: { provider: 'systeme.io', externalId } },
      data: { status, error, processedAt: new Date() },
    });
  }
}

interface ParsedEvent {
  externalId: string;
  eventType: string;
  customerEmail: string;
  productId: string;
  firstName: string;
  lastName: string;
}
