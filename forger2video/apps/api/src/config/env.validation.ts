import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

/**
 * Validation des variables d'environnement au démarrage.
 * L'application refuse de démarrer si une variable critique manque :
 * on échoue tôt plutôt qu'en production au premier appel.
 */
class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(16)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL?: string;

  @IsInt()
  @IsOptional()
  JWT_REFRESH_TTL_DAYS?: number;

  @IsString()
  @MinLength(16)
  SYSTEME_IO_WEBHOOK_SECRET!: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  CLOUDFLARE_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  CLOUDFLARE_STREAM_API_TOKEN?: string;

  @IsString()
  @IsOptional()
  CLOUDFLARE_STREAM_SIGNING_KEY_ID?: string;

  @IsString()
  @IsOptional()
  CLOUDFLARE_STREAM_SIGNING_KEY_PEM?: string;

  // ── Cloudflare R2 (hébergement vidéo compatible S3) ──
  @IsString()
  @IsOptional()
  R2_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  R2_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  R2_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  R2_BUCKET?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Configuration invalide :\n${errors
        .map((e) => `- ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return validated;
}
