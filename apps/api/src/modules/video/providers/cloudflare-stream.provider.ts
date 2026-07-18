import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import type {
  DirectUpload,
  PlaybackGrant,
  VideoProvider,
  VideoStatus,
} from '../video-provider.interface';

/**
 * Cloudflare Stream.
 *
 * Lecture — vidéos en mode « Require Signed URLs » : le token est un JWT RS256
 * signé LOCALEMENT avec la clé de signature (Stream > Signing Keys) : aucun
 * appel réseau par lecture, ce qui tient 100 000+ utilisateurs sans dépendre
 * de l'API.
 *
 * Upload — « Direct Creator Upload » : l'API demande à Cloudflare une URL
 * d'upload à usage unique, le navigateur du formateur téléverse directement
 * chez Cloudflare (le fichier ne transite jamais par notre backend).
 */
@Injectable()
export class CloudflareStreamProvider implements VideoProvider {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly keyId?: string;
  private readonly privateKeyPem?: string;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService) {
    this.accountId = config.getOrThrow<string>('CLOUDFLARE_ACCOUNT_ID');
    this.apiToken = config.getOrThrow<string>('CLOUDFLARE_STREAM_API_TOKEN');
    this.ttlSeconds = Number(config.get('VIDEO_PLAYBACK_TOKEN_TTL') ?? 3600);

    // Clés de signature optionnelles à la construction : l'upload fonctionne
    // sans elles ; la lecture signée les exige (erreur claire le cas échéant).
    this.keyId = config.get<string>('CLOUDFLARE_STREAM_SIGNING_KEY_ID') || undefined;
    const rawPem = config.get<string>('CLOUDFLARE_STREAM_SIGNING_KEY_PEM') || undefined;
    this.privateKeyPem = rawPem
      ? rawPem.includes('-----BEGIN')
        ? rawPem
        : Buffer.from(rawPem, 'base64').toString('utf8')
      : undefined;
  }

  // ─────────────────────────── Lecture ───────────────────────────

  async createPlaybackGrant(videoId: string): Promise<PlaybackGrant> {
    if (!this.keyId || !this.privateKeyPem) {
      throw new ServiceUnavailableException(
        'Lecture signée non configurée : renseignez CLOUDFLARE_STREAM_SIGNING_KEY_ID et _PEM',
      );
    }

    const expiresAt = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const header = this.base64url(JSON.stringify({ alg: 'RS256', kid: this.keyId }));
    const payload = this.base64url(
      JSON.stringify({
        sub: videoId,
        kid: this.keyId,
        exp: expiresAt,
        accessRules: [{ type: 'any', action: 'allow' }],
      }),
    );

    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const signature = signer.sign(this.privateKeyPem, 'base64url');
    const token = `${header}.${payload}.${signature}`;

    return {
      token,
      hlsUrl: `https://customer-${this.accountId}.cloudflarestream.com/${token}/manifest/video.m3u8`,
      iframeUrl: `https://customer-${this.accountId}.cloudflarestream.com/${token}/iframe`,
      expiresAt,
    };
  }

  // ─────────────────────────── Upload ───────────────────────────

  async createDirectUpload(meta: { creatorId: string }): Promise<DirectUpload> {
    const result = await this.api<{ uid: string; uploadURL: string }>(
      `/stream/direct_upload`,
      'POST',
      {
        maxDurationSeconds: 6 * 3600, // 6 h max par vidéo
        requireSignedURLs: true, // protection PRD : jamais de lecture publique
        creator: meta.creatorId,
      },
    );
    return { videoId: result.uid, uploadUrl: result.uploadURL };
  }

  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    const result = await this.api<{
      readyToStream: boolean;
      duration: number;
      thumbnail: string;
    }>(`/stream/${videoId}`, 'GET');

    return {
      ready: result.readyToStream === true,
      durationSeconds:
        typeof result.duration === 'number' && result.duration > 0
          ? Math.round(result.duration)
          : null,
      thumbnailUrl: result.thumbnail ?? null,
    };
  }

  // ─────────────────────────── privé ───────────────────────────

  private async api<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );

    const json = (await res.json()) as {
      success: boolean;
      result: T;
      errors?: { message: string }[];
    };
    if (!res.ok || !json.success) {
      const message = json.errors?.map((e) => e.message).join(', ') ?? `HTTP ${res.status}`;
      throw new ServiceUnavailableException(`API Cloudflare Stream : ${message}`);
    }
    return json.result;
  }

  private base64url(input: string): string {
    return Buffer.from(input).toString('base64url');
  }
}
