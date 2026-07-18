import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CloudflareStreamProvider } from './providers/cloudflare-stream.provider';
import { DevVideoProvider } from './providers/dev-video.provider';
import { VIDEO_PROVIDER } from './video-provider.interface';
import { VideoController } from './video.controller';

/**
 * Compte Cloudflare configuré (ACCOUNT_ID + API_TOKEN) → adaptateur Stream
 * (upload direct + tokens signés) ; sinon → adaptateur de développement.
 */
@Module({
  imports: [EnrollmentsModule],
  controllers: [VideoController],
  providers: [
    {
      provide: VIDEO_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('CLOUDFLARE_ACCOUNT_ID') &&
        config.get<string>('CLOUDFLARE_STREAM_API_TOKEN')
          ? new CloudflareStreamProvider(config)
          : new DevVideoProvider(config),
    },
  ],
  exports: [VIDEO_PROVIDER],
})
export class VideoModule {}
