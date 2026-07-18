import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { AdminQuizController, QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

@Module({
  imports: [EnrollmentsModule],
  controllers: [QuizController, AdminQuizController],
  providers: [QuizService],
})
export class QuizModule {}
