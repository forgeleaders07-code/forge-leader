import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DefineQuizDto, SubmitQuizDto } from './dto/quiz.dto';
import { QuizService } from './quiz.service';

/** Passage du quiz côté apprenant (jamais de réponses dans les payloads). */
@Controller('quiz')
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get('lessons/:lessonId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.quiz.getQuizForLearner(user.id, lessonId);
  }

  @Post('lessons/:lessonId/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quiz.submitQuiz(user.id, lessonId, dto);
  }
}

/** Édition du quiz côté formateur/admin. */
@Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
@Controller('admin')
export class AdminQuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get('lessons/:lessonId/quiz')
  get(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.quiz.getQuizForEditor(user, lessonId);
  }

  @Put('lessons/:lessonId/quiz')
  define(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: DefineQuizDto,
  ) {
    return this.quiz.defineQuiz(user, lessonId, dto);
  }
}
