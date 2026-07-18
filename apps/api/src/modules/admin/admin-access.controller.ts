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
import { IsEmail, IsUUID } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { UsersService } from '../users/users.service';

class GrantAccessDto {
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
   * Attribution manuelle : l'utilisateur est provisionné s'il n'existe pas
   * (même parcours qu'un achat webhook, email d'accueil compris via le
   * provisioning — volontairement sans email ici : action d'admin explicite).
   */
  @Post('enrollments/grant')
  async grant(@Body() dto: GrantAccessDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Formation introuvable');

    const { user } = await this.users.findOrCreateProvisioned({
      email: dto.email,
      firstName: 'Apprenant',
      lastName: '',
    });

    const { enrollment, wasNew } = await this.enrollments.grantAccess(
      user.id,
      course.id,
      EnrollmentSource.MANUAL_ADMIN,
    );
    return { enrollment, wasNew, userId: user.id };
  }

  @Post('enrollments/revoke')
  async revoke(@Body() dto: GrantAccessDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.enrollments.revokeAccess(user.id, dto.courseId);
    return { revoked: true };
  }
}
