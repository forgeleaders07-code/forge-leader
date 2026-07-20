import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CloudflareStreamProvider } from './providers/cloudflare-stream.provider';
import { DevVideoProvider } from './providers/dev-video.provider';
import { R2VideoProvider } from './providers/r2-video.provider';
import { VIDEO_PROVIDER } from './video-provider.interface';
import { VideoController } from './video.controller';

/**
 * Sélection du fournisseur de vidéo selon l'environnement, par priorité :
 *   1. Cloudflare R2 (identifiants S3 complets) → hébergement mp4 + URLs
 *      présignées, lecture HTML5 native ;
 *   2. Cloudflare Stream (ACCOUNT_ID + STREAM_API_TOKEN) → upload direct +
 *      tokens de lecture signés (HLS) ;
 *   3. sinon → adaptateur de développement.
 */
@Module({
  imports: [EnrollmentsModule],
  controllers: [VideoController],
  providers: [
    {
      provide: VIDEO_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const hasR2 =
          config.get<string>('R2_ACCOUNT_ID') &&
          config.get<string>('R2_ACCESS_KEY_ID') &&
          config.get<string>('R2_SECRET_ACCESS_KEY') &&
          config.get<string>('R2_BUCKET');
        if (hasR2) return new R2VideoProvider(config);

        return config.get<string>('CLOUDFLARE_ACCOUNT_ID') &&
          config.get<string>('CLOUDFLARE_STREAM_API_TOKEN')
          ? new CloudflareStreamProvider(config)
          : new DevVideoProvider(config);
      },
    },
  ],
  exports: [VIDEO_PROVIDER],
})
export class VideoModule {}
