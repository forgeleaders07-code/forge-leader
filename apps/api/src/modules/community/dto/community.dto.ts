import { ReactionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Trim AVANT validation : une suite d'espaces n'est pas un contenu. */
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreatePostDto {
  @trim()
  @IsString()
  @MinLength(1, { message: 'La publication ne peut pas être vide' })
  @MaxLength(5000)
  content!: string;
}

export class CreateCommentDto {
  @trim()
  @IsString()
  @MinLength(1, { message: 'Le commentaire ne peut pas être vide' })
  @MaxLength(2000)
  content!: string;
}

export class ReactDto {
  @IsEnum(ReactionType)
  type!: ReactionType;
}

export class FeedQueryDto {
  /** Curseur : id du dernier post de la page précédente. */
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number) // les query params arrivent en chaîne
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
