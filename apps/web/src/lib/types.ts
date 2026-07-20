/** Contrats de l'API consommés par le front (miroir des réponses NestJS). */

export interface MyCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  enrolledAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'RESOURCE';
  position: number;
  durationSeconds: number | null;
  isFreePreview: boolean;
  completed: boolean;
  lastPositionSeconds: number;
}

export interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  modules: {
    id: string;
    title: string;
    position: number;
    chapters: {
      id: string;
      title: string;
      position: number;
      lessons: LessonSummary[];
    }[];
  }[];
}

export interface PlaybackGrant {
  token: string;
  hlsUrl: string;
  iframeUrl: string;
  /** URL mp4 présignée (R2) lue en <video> natif ; absente pour Cloudflare Stream. */
  url?: string;
  expiresAt: number;
}
