/**
 * Abstraction du fournisseur de streaming (ADR 0001) :
 * Cloudflare Stream aujourd'hui, Mux possible demain via un simple adaptateur.
 * Le domaine ne connaît que cette interface.
 */
export const VIDEO_PROVIDER = Symbol('VIDEO_PROVIDER');

export interface PlaybackGrant {
  /** Token de lecture signé, à durée courte, lié à une seule vidéo. */
  token: string;
  /** URL du manifeste HLS prête à l'emploi pour le player. */
  hlsUrl: string;
  /** URL de l'iframe du player Cloudflare (alternative simple côté front). */
  iframeUrl: string;
  /**
   * URL mp4 présignée à durée courte, lue en HTML5 natif (<video>).
   * Renseignée par les providers « fichier » (R2). Absente pour Cloudflare
   * Stream, qui expose HLS + iframe. Le front la privilégie quand elle existe.
   */
  url?: string;
  /** Expiration du droit de lecture (epoch secondes). */
  expiresAt: number;
}

export interface DirectUpload {
  /** Identifiant de la vidéo chez le provider (deviendra le streamVideoId). */
  videoId: string;
  /** URL à usage unique vers laquelle le NAVIGATEUR téléverse directement. */
  uploadUrl: string;
  /**
   * Méthode HTTP à employer par le navigateur pour téléverser.
   * `POST` (multipart, défaut) pour Cloudflare/Dev ; `PUT` (corps brut) pour
   * une URL présignée S3/R2. Le front s'y adapte.
   */
  uploadMethod?: 'POST' | 'PUT';
}

export interface VideoStatus {
  /** true quand l'encodage est terminé et la vidéo lisible. */
  ready: boolean;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
}

export interface VideoProvider {
  /**
   * Délivre un droit de lecture pour UNE vidéo.
   * L'appelant doit avoir vérifié l'enrollment AVANT d'appeler cette méthode.
   */
  createPlaybackGrant(videoId: string): Promise<PlaybackGrant>;

  /**
   * Crée un téléversement direct (Direct Creator Upload) : le fichier va du
   * navigateur au provider sans transiter par notre API.
   * L'appelant doit avoir vérifié les droits d'édition AVANT.
   */
  createDirectUpload(meta: { creatorId: string }): Promise<DirectUpload>;

  /** Statut d'encodage d'une vidéo téléversée. */
  getVideoStatus(videoId: string): Promise<VideoStatus>;
}
