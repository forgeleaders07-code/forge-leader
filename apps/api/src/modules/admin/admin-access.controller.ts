import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnrollmentSource, UserRole, UserStatus } from '@prisma/client';
import { IsEmail, IsOptional, IsString, MaxLength, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

class GrantAccessDto {
  @IsEmail()
  email!: string;

  @IsUUID()
  courseId!: string;

  /** Prénom/nom facultatifs pour personnaliser l'email d'accueil. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}

class RevokeAccessDto {
  @IsEmail()
  email!: string;

  @IsUUID()
  courseId!: string;
}

/**
 * Gestion manuelle des accès — réservée aux ADMIN (PRD §4) :
 * attribution hors webhook (vente WhatsApp / Mobile Money), révocation
 * (remboursement, litige), consultation des inscrits.
 */
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminAccessController {
  private readonly logger = new Logger(AdminAccessController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly enrollments: EnrollmentsService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Recherche d'utilisateurs (email ou nom, insensible à la casse). */
  @Get('users')
  async searchUsers(@Query('query') query?: string) {
    const users = await this.prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { enrollments: { where: { revokedAt: null } } } },
      },
    });
    return users.map(({ _count, ...u }) => ({ ...u, activeEnrollments: _count.enrollments }));
  }

  /** Inscrits d'une formation (accès actifs et révoqués, pour audit). */
  @Get('courses/:courseId/enrollments')
  async listEnrollments(@Param('courseId') courseId: string) {
    return this.prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
      },
    });
  }

  /**
   * Attribution manuelle (ventes WhatsApp / Mobile Money).
   *
   * Renvoie un `activationLink` copiable quand le compte n'a pas encore de
   * mot de passe : l'admin le transmet au membre (WhatsApp, SMS…) — c'est le
   * canal fiable, indépendant de l'email.
   *
   * L'email est envoyé « en plus » mais reste NON bloquant : un échec d'envoi
   * (Resend en mode test, domaine non vérifié, quota…) ne doit jamais faire
   * échouer l'attribution d'accès.
   */
  @Post('enrollments/grant')
  async grant(@Body() dto: GrantAccessDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Formation introuvable');

    const { user } = await this.users.findOrCreateProvisioned({
      email: dto.email,
      firstName: dto.firstName?.trim() || 'Apprenant',
      lastName: dto.lastName?.trim() || '',
    });

    const { enrollment, wasNew } = await this.enrollments.grantAccess(
      user.id,
      course.id,
      EnrollmentSource.MANUAL_ADMIN,
    );

    // Compte sans mot de passe → il faut un lien d'activation (nouveau compte,
    // ou compte provisionné qui n'a jamais été activé).
    const needsActivation = user.status === UserStatus.PENDING_ACTIVATION;

    let activationLink: string | null = null;
    let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';

    if (needsActivation) {
      const token = await this.auth.createActivationToken(user.id);
      const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
      activationLink = `${frontend}/activation?userId=${encodeURIComponent(
        user.id,
      )}&token=${encodeURIComponent(token)}`;
      emailStatus = await this.trySend(() =>
        this.mail.sendWelcomeEmail({
          to: user.email,
          firstName: user.firstName,
          courseTitle: course.title,
          userId: user.id,
          activationToken: token,
        }),
      );
    } else if (wasNew) {
      // Compte déjà actif recevant une nouvelle formation : simple notification.
      emailStatus = await this.trySend(() =>
        this.mail.sendCourseAddedEmail({
          to: user.email,
          firstName: user.firstName,
          courseTitle: course.title,
        }),
      );
    }

    return { enrollment, wasNew, userId: user.id, needsActivation, activationLink, emailStatus };
  }

  /** Envoi best-effort : journalise l'échec sans le propager. */
  private async trySend(send: () => Promise<void>): Promise<'sent' | 'failed'> {
    try {
      await send();
      return 'sent';
    } catch (e) {
      this.logger.warn(`Envoi d'email échoué (non bloquant) : ${e instanceof Error ? e.message : e}`);
      return 'failed';
    }
  }

  @Post('enrollments/revoke')
  async revoke(@Body() dto: RevokeAccessDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.enrollments.revokeAccess(user.id, dto.courseId);
    return { revoked: true };
  }

  /**
   * Suppression définitive d'un membre et de toutes ses données (accès,
   * progression, messages, certificats… en cascade). Irréversible.
   * Garde-fou : on ne peut pas supprimer son propre compte.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('users/:id')
  async deleteUser(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    if (actor.id === id) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Membre introuvable');
    await this.prisma.user.delete({ where: { id } });
  }
}
