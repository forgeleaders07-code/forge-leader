import { Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateProvisionedUserInput {
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  /**
   * Création (ou récupération) d'un compte provisionné par webhook d'achat.
   * Idempotent par email : un deuxième achat rattache l'accès au compte existant.
   */
  async findOrCreateProvisioned(input: CreateProvisionedUserInput): Promise<{ user: User; created: boolean }> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return { user: existing, created: false };

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: UserRole.LEARNER,
        status: UserStatus.PENDING_ACTIVATION,
      },
    });
    return { user, created: true };
  }
}
