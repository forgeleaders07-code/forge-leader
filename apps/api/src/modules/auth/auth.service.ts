import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessTokenPayload } from './types/authenticated-user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

/**
 * Authentification à double jeton :
 *  - access token JWT court (15 min) — jamais stocké côté serveur ;
 *  - refresh token opaque long (30 j) — stocké haché, à usage unique (rotation).
 * La réutilisation d'un refresh token déjà consommé révoque toute la famille :
 * c'est le signal d'un vol de token.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, meta?: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Réponse identique que l'email existe ou non (pas d'énumération de comptes)
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Compte suspendu');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user, randomUUID(), meta);
    return this.toAuthResult(user, tokens);
  }

  /** Rotation : consomme le refresh token, en émet un nouveau de la même famille. */
  async refresh(rawToken: string, meta?: { userAgent?: string; ip?: string }): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Session invalide');
    }

    // Token déjà consommé ou révoqué → vol probable : on tue la famille entière.
    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      this.logger.warn(`Réutilisation de refresh token détectée (famille ${stored.familyId})`);
      throw new UnauthorizedException('Session révoquée');
    }

    if (stored.expiresAt < new Date() || stored.user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Session expirée');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, stored.familyId, meta);
  }

  async logout(rawToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });
    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
    // Pas d'erreur si le token est inconnu : le logout est idempotent.
  }

  /** Active un compte provisionné par webhook (définition du mot de passe). */
  async activateAccount(userId: string, rawToken: string, password: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(rawToken);
    const activation = await this.prisma.activationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!activation || activation.userId !== userId) {
      throw new BadRequestException("Lien d'activation invalide");
    }
    if (activation.usedAt || activation.expiresAt < new Date()) {
      throw new BadRequestException("Lien d'activation expiré — demandez un nouvel email");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.activationToken.update({
        where: { id: activation.id },
        data: { usedAt: new Date() },
      });
      return tx.user.update({
        where: { id: userId },
        data: { passwordHash, status: UserStatus.ACTIVE },
      });
    });

    const tokens = await this.issueTokens(user, randomUUID());
    return this.toAuthResult(user, tokens);
  }

  /** Génère un token d'activation (utilisé par le provisioning webhook). */
  async createActivationToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.activationToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 jours
      },
    });
    return raw;
  }

  // ─────────────────────────── privé ───────────────────────────

  private async issueTokens(
    user: User,
    familyId: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthTokens> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        familyId,
        userId: user.id,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 3600 * 1000),
        userAgent: meta?.userAgent?.slice(0, 255),
        ipAddress: meta?.ip,
      },
    });

    return { accessToken, refreshToken };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** SHA-256 : suffisant pour un secret à haute entropie (pas un mot de passe). */
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private toAuthResult(user: User, tokens: AuthTokens): AuthResult {
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
