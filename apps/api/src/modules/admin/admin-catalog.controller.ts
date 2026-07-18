import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AdminCatalogService } from './admin-catalog.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  CreateTitledDto,
  MoveDto,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateTitledDto,
} from './dto/catalog.dto';

/**
 * Catalogue côté formateur/admin.
 * ADMIN : tout le catalogue · INSTRUCTOR : uniquement ses formations
 * (la règle de propriété est appliquée dans le service).
 */
@Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  // ─── Formations ───
  @Get('courses')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listCourses(user);
  }

  @Post('courses')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    return this.catalog.createCourse(user, dto);
  }

  @Get('courses/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.getCourse(user, id);
  }

  @Patch('courses/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.catalog.updateCourse(user, id, dto);
  }

  @Delete('courses/:id')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.archiveCourse(user, id);
  }

  // ─── Modules ───
  @Post('courses/:courseId/modules')
  createModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateTitledDto,
  ) {
    return this.catalog.createModule(user, courseId, dto.title);
  }

  @Patch('modules/:id')
  renameModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTitledDto,
  ) {
    return this.catalog.renameModule(user, id, dto.title);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('modules/:id')
  async deleteModule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.catalog.deleteModule(user, id);
  }

  @Put('modules/:id/move')
  moveModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ) {
    return this.catalog.moveModule(user, id, dto.direction);
  }

  // ─── Chapitres ───
  @Post('modules/:moduleId/chapters')
  createChapter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateTitledDto,
  ) {
    return this.catalog.createChapter(user, moduleId, dto.title);
  }

  @Patch('chapters/:id')
  renameChapter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTitledDto,
  ) {
    return this.catalog.renameChapter(user, id, dto.title);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('chapters/:id')
  async deleteChapter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.catalog.deleteChapter(user, id);
  }

  @Put('chapters/:id/move')
  moveChapter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ) {
    return this.catalog.moveChapter(user, id, dto.direction);
  }

  // ─── Leçons ───
  @Post('chapters/:chapterId/lessons')
  createLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.catalog.createLesson(user, chapterId, dto);
  }

  @Patch('lessons/:id')
  updateLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.catalog.updateLesson(user, id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('lessons/:id')
  async deleteLesson(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.catalog.deleteLesson(user, id);
  }

  @Put('lessons/:id/move')
  moveLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ) {
    return this.catalog.moveLesson(user, id, dto.direction);
  }

  // ─── Upload vidéo ───
  @Post('lessons/:id/video-upload')
  requestVideoUpload(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.requestVideoUpload(user, id);
  }

  @Get('lessons/:id/video-status')
  videoStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.getLessonVideoStatus(user, id);
  }
}
