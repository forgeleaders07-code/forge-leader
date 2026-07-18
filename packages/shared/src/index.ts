/**
 * Contrats partagés API ↔ front.
 * Volontairement minimal au stade du socle : les DTO seront extraits ici
 * au fur et à mesure (source de vérité unique des types réseau).
 */

export const USER_ROLES = ['LEARNER', 'INSTRUCTOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LESSON_TYPES = ['VIDEO', 'TEXT', 'QUIZ', 'RESOURCE'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];
