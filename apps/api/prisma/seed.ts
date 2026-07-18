import { PrismaClient, CourseStatus, LessonType, UserRole, UserStatus, EnrollmentSource } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Données de développement : un admin, un apprenant activé,
 * une formation publiée avec accès attribué à l'apprenant.
 * Idempotent (upsert partout) — jamais exécuté en production.
 */
async function main(): Promise<void> {
  const learnerPassword = await argon2.hash('Apprenant123', { type: argon2.argon2id });
  const adminPassword = await argon2.hash('Admin12345!', { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@laforgedesleaders.test' },
    update: {},
    create: {
      email: 'admin@laforgedesleaders.test',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Forge',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const learner = await prisma.user.upsert({
    where: { email: 'apprenant@laforgedesleaders.test' },
    update: {},
    create: {
      email: 'apprenant@laforgedesleaders.test',
      passwordHash: learnerPassword,
      firstName: 'Awa',
      lastName: 'Diallo',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
    },
  });

  const course = await prisma.course.upsert({
    where: { slug: 'leadership-fondations' },
    update: {},
    create: {
      slug: 'leadership-fondations',
      title: 'Leadership : Les Fondations',
      description:
        'Le socle du leadership selon La Forge des Leaders : posture, vision, communication et discipline.',
      status: CourseStatus.PUBLISHED,
      externalProductIds: ['sio-prod-demo-001'],
      instructorId: admin.id,
      modules: {
        create: [
          {
            title: 'Module 1 — La posture du leader',
            position: 1,
            chapters: {
              create: [
                {
                  title: 'Chapitre 1 — Comprendre son rôle',
                  position: 1,
                  lessons: {
                    create: [
                      {
                        title: 'Bienvenue dans la formation',
                        type: LessonType.VIDEO,
                        position: 1,
                        durationSeconds: 300,
                        isFreePreview: true,
                        streamVideoId: 'demo-video-001',
                      },
                      {
                        title: 'Les 3 piliers du leadership',
                        type: LessonType.VIDEO,
                        position: 2,
                        durationSeconds: 900,
                        streamVideoId: 'demo-video-002',
                      },
                      {
                        title: 'Synthèse du chapitre',
                        type: LessonType.TEXT,
                        position: 3,
                        content: 'Récapitulatif des points clés du chapitre 1.',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: learner.id, courseId: course.id } },
    update: {},
    create: {
      userId: learner.id,
      courseId: course.id,
      source: EnrollmentSource.MANUAL_ADMIN,
    },
  });

  console.log('Seed terminé :');
  console.log('  Admin     : admin@laforgedesleaders.test / Admin12345!');
  console.log('  Apprenant : apprenant@laforgedesleaders.test / Apprenant123');
  console.log(`  Formation : ${course.title} (${course.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
