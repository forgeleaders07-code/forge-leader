import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type {
  DirectUpload,
  PlaybackGrant,
  VideoProvider,
  VideoStatus,
} from '../video-provider.interface';

/**
 * Adaptateur de développement : permet de développer et tester tout le flux
 * (contrôle d'accès et upload compris) sans compte Cloudflare configuré.
 * L'upload pointe vers un endpoint local qui absorbe le fichier ; le statut
 * devient « prêt » immédiatement avec une durée factice.
 */
@Injectable()
export class DevVideoProvider implements VideoProvider {
  private readonly logger = new Logger('Video');
  private readonly apiBaseUrl: string;

  constructor(config: ConfigService) {
    const port = Number(config.get('PORT') ?? 3001);
    this.apiBaseUrl = `http://localhost:${port}/api/v1`;
  }

  async createPlaybackGrant(videoId: string): Promise<PlaybackGrant> {
    this.logger.warn(`[DEV] Grant de lecture factice pour la vidéo ${videoId}`);
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    return {
      token: `dev-token-${videoId}`,
      hlsUrl: `https://dev.invalid/${videoId}/manifest/video.m3u8`,
      iframeUrl: `https://dev.invalid/${videoId}/iframe`,
      expiresAt,
    };
  }

  async createDirectUpload(meta: { creatorId: string }): Promise<DirectUpload> {
    const videoId = `dev-${randomUUID()}`;
    this.logger.warn(`[DEV] Upload direct simulé (${videoId}) pour ${meta.creatorId}`);
    return {
      videoId,
      uploadUrl: `${this.apiBaseUrl}/video/dev-upload/${videoId}`,
    };
  }

  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    return { ready: true, durationSeconds: 300, thumbnailUrl: null };
  }
}
