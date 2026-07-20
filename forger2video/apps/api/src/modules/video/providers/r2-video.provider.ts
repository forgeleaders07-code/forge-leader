import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import type {
  DirectUpload,
  PlaybackGrant,
  VideoProvider,
  VideoStatus,
} from '../video-provider.interface';

/**
 * Cloudflare R2 (compatible S3).
 *
 * Hébergement des vidéos de formation à coût nul jusqu'à 10 Go. R2 expose une
 * API S3 : on s'appuie sur le SDK AWS pour signer des URLs temporaires.
 *
 * Upload — URL présignée PUT : le navigateur de l'admin téléverse le fichier
 * mp4 directement vers R2 (le fichier ne transite jamais par notre backend).
 * La clé d'objet est un UUID (persisté comme streamVideoId).
 *
 * Lecture — URL présignée GET à durée courte (VIDEO_PLAYBACK_TOKEN_TTL),
 * délivrée uniquement après le contrôle d'enrollment déjà en place. Le lecteur
 * la lit en HTML5 natif (<video>), sans encodage HLS ni iframe.
 */
@Injectable()
export class R2VideoProvider implements VideoProvider {
  private readonly logger = new Logger('Video');
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly ttlSeconds: number;
  /** TTL de l'URL d'upload : assez large pour un gros fichier sur réseau lent. */
  private readonly uploadTtlSeconds = 3600;

  constructor(config: ConfigService) {
    const accountId = config.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = config.getOrThrow<string>('R2_BUCKET');
    this.ttlSeconds = Number(config.get('VIDEO_PLAYBACK_TOKEN_TTL') ?? 3600);

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  // ─────────────────────────── Lecture ───────────────────────────

  async createPlaybackGrant(videoId: string): Promise<PlaybackGrant> {
    const expiresAt = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    let url: string;
    try {
      url = await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: videoId }),
        { expiresIn: this.ttlSeconds },
      );
    } catch (e) {
      throw new ServiceUnavailableException(
        `Signature de l'URL de lecture R2 impossible : ${this.reason(e)}`,
      );
    }

    // hlsUrl/iframeUrl conservés pour la compat de l'interface ; le front
    // privilégie `url` (mp4 natif) dès qu'elle est présente.
    return { token: videoId, hlsUrl: url, iframeUrl: '', url, expiresAt };
  }

  // ─────────────────────────── Upload ───────────────────────────

  async createDirectUpload(meta: { creatorId: string }): Promise<DirectUpload> {
    const videoId = randomUUID();
    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: videoId,
          ContentType: 'video/mp4',
        }),
        { expiresIn: this.uploadTtlSeconds },
      );
    } catch (e) {
      throw new ServiceUnavailableException(
        `Signature de l'URL d'upload R2 impossible : ${this.reason(e)}`,
      );
    }

    this.logger.log(`Upload direct R2 (${videoId}) pour ${meta.creatorId}`);
    return { videoId, uploadUrl, uploadMethod: 'PUT' };
  }

  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    // Pas d'encodage : l'objet est lisible dès que le PUT a réussi. On vérifie
    // simplement sa présence. La durée n'est pas extraite côté serveur (mp4
    // servi tel quel) ; le front l'obtient à la lecture via les métadonnées.
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: videoId }),
      );
      return { ready: true, durationSeconds: null, thumbnailUrl: null };
    } catch (e) {
      if (this.isNotFound(e)) {
        return { ready: false, durationSeconds: null, thumbnailUrl: null };
      }
      throw new ServiceUnavailableException(
        `Statut de la vidéo R2 indisponible : ${this.reason(e)}`,
      );
    }
  }

  // ─────────────────────────── privé ───────────────────────────

  private isNotFound(e: unknown): boolean {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    return err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
  }

  private reason(e: unknown): string {
    return e instanceof Error ? e.message : 'erreur inconnue';
  }
}
