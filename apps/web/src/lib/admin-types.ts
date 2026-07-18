/** Contrats des endpoints /admin consommés par l'espace d'administration. */

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LessonType = 'VIDEO' | 'TEXT' | 'QUIZ' | 'RESOURCE';

export interface AdminCourseSummary {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  coverUrl: string | null;
  externalProductIds: string[];
  activeEnrollments: number;
  lessonCount: number;
  updatedAt: string;
}

export interface AdminLesson {
  id: string;
  chapterId: string;
  title: string;
  type: LessonType;
  position: number;
  streamVideoId: string | null;
  durationSeconds: number | null;
  content: string | null;
  isFreePreview: boolean;
}

export interface AdminChapter {
  id: string;
  moduleId: string;
  title: string;
  position: number;
  lessons: AdminLesson[];
}

export interface AdminModule {
  id: string;
  courseId: string;
  title: string;
  position: number;
  chapters: AdminChapter[];
}

export interface AdminCourseDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  status: CourseStatus;
  externalProductIds: string[];
  modules: AdminModule[];
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  activeEnrollments: number;
}

export interface AdminEnrollment {
  id: string;
  createdAt: string;
  revokedAt: string | null;
  source: string;
  user: { id: string; email: string; firstName: string; lastName: string; status: string };
}
