import { CourseStatus, LessonType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Le slug ne peut contenir que minuscules, chiffres et tirets',
  })
  @MaxLength(160)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  /** Identifiants produits Systeme.io mappés sur cette formation. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  externalProductIds?: string[];
}

export class CreateTitledDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;
}

export class UpdateTitledDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;
}

export class MoveDto {
  @IsEnum(['up', 'down'] as const)
  direction!: 'up' | 'down';
}

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsEnum(LessonType)
  type!: LessonType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  streamVideoId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;
}

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  streamVideoId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;
}
