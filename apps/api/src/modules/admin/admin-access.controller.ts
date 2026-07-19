import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { EnrollmentSource, UserRole } from '@prisma/client';
import { IsEmail, IsOptional, IsString, MaxLength, IsUUID } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly enrollments: EnrollmentsService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
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
   * Attribution manuelle : même parcours qu'un achat webhook.
   * - Compte nouvellement créé → email d'activation (le membre définit son
   *   mot de passe, sans quoi il ne pourrait jamais se connecter).
   * - Compte existant recevant un nouvel accès → email « formation débloquée ».
   */
  @Post('enrollments/grant')
  async grant(@Body() dto: GrantAccessDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Formation introuvable');

    const { user, created } = await this.users.findOrCreateProvisioned({
      email: dto.email,
      firstName: dto.firstName?.trim() || 'Apprenant',
      lastName: dto.lastName?.trim() || '',
    });

    const { enrollment, wasNew } = await this.enrollments.grantAccess(
      user.id,
      course.id,
      EnrollmentSource.MANUAL_ADMIN,
    );

    let emailSent: 'activation' | 'course-added' | 'none' = 'none';
    if (created) {
      const activationToken = await this.auth.createActivationToken(user.id);
      await this.mail.sendWelcomeEmail({
        to: user.email,
        firstName: user.firstName,
        courseTitle: course.title,
        userId: user.id,
        activationToken,
      });
      emailSent = 'activation';
    } else if (wasNew) {
      await this.mail.sendCourseAddedEmail({
        to: user.email,
        firstName: user.firstName,
        courseTitle: course.title,
      });
      emailSent = 'course-added';
    }

    return { enrollment, wasNew, userId: user.id, emailSent };
  }

  @Post('enrollments/revoke')
  async revoke(@Body() dto: RevokeAccessDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.enrollments.revokeAccess(user.id, dto.courseId);
    return { revoked: true };
  }
}
