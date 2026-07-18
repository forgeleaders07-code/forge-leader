import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { LessonType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { VIDEO_PROVIDER, VideoProvider } from './video-provider.interface';

/**
 * Point unique de délivrance des droits de lecture vidéo.
 * Règle absolue (PRD §7 Sécurité) : aucun token n'est émis sans avoir
 * vérifié, à l'instant T, que l'utilisateur a un enrollment actif.
 */
@Controller('video')
export class VideoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: EnrollmentsService,
    @Inject(VIDEO_PROVIDER) private readonly video: VideoProvider,
  ) {}

  @Post('lessons/:lessonId/playback')
  async getPlayback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { module: true } } },
    });

    if (!lesson || lesson.type !== LessonType.VIDEO || !lesson.streamVideoId) {
      throw new NotFoundException('Vidéo introuvable');
    }

    // Les leçons en aperçu gratuit restent lisibles sans enrollment
    if (!lesson.isFreePreview) {
      const hasAccess = await this.enrollments.hasActiveAccess(
        user.id,
        lesson.chapter.module.courseId,
      );
      if (!hasAccess) {
        throw new ForbiddenException("Vous n'avez pas accès à cette vidéo");
      }
    }

    return this.video.createPlaybackGrant(lesson.streamVideoId);
  }

  /**
   * Réceptacle d'upload de l'adaptateur de DÉVELOPPEMENT uniquement :
   * absorbe le fichier envoyé par le navigateur et répond OK, comme le ferait
   * l'endpoint direct de Cloudflare. Sans effet en production (jamais référencé
   * par l'adaptateur Cloudflare).
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('dev-upload/:videoId')
  devUpload(@Param('videoId') videoId: string) {
    return { received: true, videoId };
  }
}
