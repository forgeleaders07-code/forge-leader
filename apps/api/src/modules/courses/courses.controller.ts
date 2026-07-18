import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CoursesService } from './courses.service';

class SaveProgressDto {
  @IsInt()
  @Min(0)
  positionSeconds!: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.courses.listMyCourses(user.id);
  }

  @Get(':slug')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.courses.getCourseForLearner(user.id, slug);
  }

  @Put('lessons/:lessonId/progress')
  saveProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: SaveProgressDto,
  ) {
    return this.courses.saveProgress(user.id, lessonId, dto);
  }
}
