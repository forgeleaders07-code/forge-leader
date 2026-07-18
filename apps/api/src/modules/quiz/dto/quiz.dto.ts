import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QuizChoiceInput {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class QuizQuestionInput {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text!: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Chaque question doit avoir au moins 2 choix' })
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => QuizChoiceInput)
  choices!: QuizChoiceInput[];
}

/** Définition complète du quiz d'une leçon (remplacement transactionnel). */
export class DefineQuizDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Un quiz doit contenir au moins une question' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionInput)
  questions!: QuizQuestionInput[];
}

export class QuizAnswerInput {
  @IsUUID()
  questionId!: string;

  @IsUUID()
  choiceId!: string;
}

export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInput)
  answers!: QuizAnswerInput[];
}
