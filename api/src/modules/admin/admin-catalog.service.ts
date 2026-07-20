import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, LessonType, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { NotificationsService } from '../notifications/notifications.service';
import { VIDEO_PROVIDER, VideoProvider } from '../video/video-provider.interface';
import { CreateCourseDto, CreateLessonDto, UpdateCourseDto, UpdateLessonDto } from './dto/catalog.dto';

/**
 * Gestion du catalogue côté formateur/admin.
 * Règle de propriété : un INSTRUCTOR ne gère que ses propres formations ;
 * un ADMIN gère tout. Toute opération imbriquée (module, chapitre, leçon)
 * remonte d'abord à la formation pour appliquer cette règle.
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VIDEO_PROVIDER) private readonly video: VideoProvider,
    private readonly notifications: NotificationsService,
  ) {}

  // ─────────────────────────── Formations ───────────────────────────

  async listCourses(user: AuthenticatedUser) {
    const where = user.role === UserRole.ADMIN ? {} : { instructorId: user.id };
    const courses = await this.prisma.course.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { enrollments: { where: { revokedAt: null } } } },
        modules: { include: { chapters: { include: { _count: { select: { lessons: true } } } } } },
      },
    });

    return courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      coverUrl: c.coverUrl,
      externalProductIds: c.externalProductIds,
      activeEnrollments: c._count.enrollments,
      lessonCount: c.modules
        .flatMap((m) => m.chapters)
        .reduce((sum, ch) => sum + ch._count.lessons, 0),
      updatedAt: c.updatedAt,
    }));
  }

  async createCourse(user: AuthenticatedUser, dto: CreateCourseDto) {
    const slug = await this.uniqueSlug(this.slugify(dto.title));
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        slug,
        status: CourseStatus.DRAFT,
        instructorId: user.id,
      },
    });
  }

  /** Arbre complet pour l'éditeur — streamVideoId inclus (contexte de confiance). */
  async getCourse(user: AuthenticatedUser, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: {
            chapters: {
              orderBy: { position: 'asc' },
              include: { lessons: { orderBy: { position: 'asc' } } },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Formation introuvable');
    this.assertOwnership(user, course.instructorId);
    return course;
  }

  async updateCourse(user: AuthenticatedUser, courseId: string, dto: UpdateCourseDto) {
    const before = await this.getOwnedCourse(user, courseId);

    if (dto.status === CourseStatus.PUBLISHED) {
      await this.assertPublishable(courseId);
    }
    if (dto.slug) {
      const clash = await this.prisma.course.findFirst({
        where: { slug: dto.slug, id: { not: courseId } },
      });
      if (clash) throw new ConflictException('Ce slug est déjà utilisé');
    }

    const updated = await this.prisma.course.update({ where: { id: courseId }, data: dto });

    // Passage en ligne → prévenir les inscrits (Vol 2 §26 « nouvelle vidéo »)
    if (dto.status === CourseStatus.PUBLISHED && before.status !== CourseStatus.PUBLISHED) {
      const enrollees = await this.prisma.enrollment.findMany({
        where: { courseId, revokedAt: null },
        select: { userId: true },
      });
      await this.notifications.notifyMany(
        enrollees.map((e) => e.userId),
        {
          type: NotificationType.COURSE_PUBLISHED,
          title: `Formation disponible : ${updated.title}`,
          link: `/formation/${updated.slug}`,
        },
      );
    }

    return updated;
  }

  /**
   * Suppression définitive d'une formation et de tout son contenu.
   * Les relations (modules, chapitres, leçons, quiz, progressions,
   * certificats, inscriptions) sont en `onDelete: Cascade` : Postgres nettoie
   * l'ensemble en une opération. Action irréversible — le front confirme.
   */
  async deleteCourse(user: AuthenticatedUser, courseId: string) {
    await this.getOwnedCourse(user, courseId);
    await this.prisma.course.delete({ where: { id: courseId } });
  }

  // ─────────────────────────── Modules ───────────────────────────

  async createModule(user: AuthenticatedUser, courseId: string, title: string) {
    await this.getOwnedCourse(user, courseId);
    const max = await this.prisma.courseModule.aggregate({
      where: { courseId },
      _max: { position: true },
    });
    return this.prisma.courseModule.create({
      data: { courseId, title, position: (max._max.position ?? 0) + 1 },
    });
  }

  async renameModule(user: AuthenticatedUser, moduleId: string, title: string) {
    await this.courseOfModule(user, moduleId);
    return this.prisma.courseModule.update({ where: { id: moduleId }, data: { title } });
  }

  async deleteModule(user: AuthenticatedUser, moduleId: string) {
    await this.courseOfModule(user, moduleId);
    await this.prisma.courseModule.delete({ where: { id: moduleId } });
  }

  async moveModule(user: AuthenticatedUser, moduleId: string, direction: 'up' | 'down') {
    await this.courseOfModule(user, moduleId);
    const current = await this.prisma.courseModule.findUniqueOrThrow({ where: { id: moduleId } });
    const neighbor = await this.prisma.courseModule.findFirst({
      where: {
        courseId: current.courseId,
        position: direction === 'up' ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return current; // déjà en bord de liste

    // Échange des positions en 3 temps (contrainte unique [courseId, position])
    await this.prisma.$transaction([
      this.prisma.courseModule.update({ where: { id: current.id }, data: { position: -1 } }),
      this.prisma.courseModule.update({
        where: { id: neighbor.id },
        data: { position: current.position },
      }),
      this.prisma.courseModule.update({
        where: { id: current.id },
        data: { position: neighbor.position },
      }),
    ]);
    return this.prisma.courseModule.findUniqueOrThrow({ where: { id: moduleId } });
  }

  // ─────────────────────────── Chapitres ───────────────────────────

  async createChapter(user: AuthenticatedUser, moduleId: string, title: string) {
    await this.courseOfModule(user, moduleId);
    const max = await this.prisma.chapter.aggregate({
      where: { moduleId },
      _max: { position: true },
    });
    return this.prisma.chapter.create({
      data: { moduleId, title, position: (max._max.position ?? 0) + 1 },
    });
  }

  async renameChapter(user: AuthenticatedUser, chapterId: string, title: string) {
    await this.courseOfChapter(user, chapterId);
    return this.prisma.chapter.update({ where: { id: chapterId }, data: { title } });
  }

  async deleteChapter(user: AuthenticatedUser, chapterId: string) {
    await this.courseOfChapter(user, chapterId);
    await this.prisma.chapter.delete({ where: { id: chapterId } });
  }

  async moveChapter(user: AuthenticatedUser, chapterId: string, direction: 'up' | 'down') {
    await this.courseOfChapter(user, chapterId);
    const current = await this.prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });
    const neighbor = await this.prisma.chapter.findFirst({
      where: {
        moduleId: current.moduleId,
        position: direction === 'up' ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return current;

    await this.prisma.$transaction([
      this.prisma.chapter.update({ where: { id: current.id }, data: { position: -1 } }),
      this.prisma.chapter.update({
        where: { id: neighbor.id },
        data: { position: current.position },
      }),
      this.prisma.chapter.update({
        where: { id: current.id },
        data: { position: neighbor.position },
      }),
    ]);
    return this.prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });
  }

  // ─────────────────────────── Leçons ───────────────────────────

  async createLesson(user: AuthenticatedUser, chapterId: string, dto: CreateLessonDto) {
    await this.courseOfChapter(user, chapterId);
    const max = await this.prisma.lesson.aggregate({
      where: { chapterId },
      _max: { position: true },
    });
    return this.prisma.lesson.create({
      data: {
        chapterId,
        title: dto.title,
        type: dto.type,
        streamVideoId: dto.streamVideoId,
        durationSeconds: dto.durationSeconds,
        content: dto.content ?? '',
        isFreePreview: dto.isFreePreview ?? false,
        position: (max._max.position ?? 0) + 1,
      },
    });
  }

  async updateLesson(user: AuthenticatedUser, lessonId: string, dto: UpdateLessonDto) {
    await this.courseOfLesson(user, lessonId);
    return this.prisma.lesson.update({ where: { id: lessonId }, data: dto });
  }

  async deleteLesson(user: AuthenticatedUser, lessonId: string) {
    await this.courseOfLesson(user, lessonId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  async moveLesson(user: AuthenticatedUser, lessonId: string, direction: 'up' | 'down') {
    await this.courseOfLesson(user, lessonId);
    const current = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const neighbor = await this.prisma.lesson.findFirst({
      where: {
        chapterId: current.chapterId,
        position: direction === 'up' ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return current;

    await this.prisma.$transaction([
      this.prisma.lesson.update({ where: { id: current.id }, data: { position: -1 } }),
      this.prisma.lesson.update({
        where: { id: neighbor.id },
        data: { position: current.position },
      }),
      this.prisma.lesson.update({
        where: { id: current.id },
        data: { position: neighbor.position },
      }),
    ]);
    return this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  }

  // ─────────────────────────── Upload vidéo ───────────────────────────

  /**
   * Prépare un téléversement direct pour une leçon vidéo : le provider délivre
   * une URL d'upload à usage unique, et la leçon est immédiatement liée au
   * nouvel identifiant (durée remise à zéro jusqu'à la fin de l'encodage).
   */
  async requestVideoUpload(user: AuthenticatedUser, lessonId: string) {
    const course = await this.courseOfLesson(user, lessonId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    if (lesson.type !== LessonType.VIDEO) {
      throw new BadRequestException("Cette leçon n'est pas de type vidéo");
    }

    const upload = await this.video.createDirectUpload({ creatorId: user.id });

    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { streamVideoId: upload.videoId, durationSeconds: null },
    });

    return { ...upload, courseId: course.id };
  }

  /** Statut d'encodage ; persiste la durée dès que la vidéo est prête. */
  async getLessonVideoStatus(user: AuthenticatedUser, lessonId: string) {
    await this.courseOfLesson(user, lessonId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    if (!lesson.streamVideoId) {
      throw new BadRequestException('Aucune vidéo associée à cette leçon');
    }

    const status = await this.video.getVideoStatus(lesson.streamVideoId);

    if (status.ready && status.durationSeconds && lesson.durationSeconds !== status.durationSeconds) {
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: { durationSeconds: status.durationSeconds },
      });
    }

    return { ...status, videoId: lesson.streamVideoId };
  }

  /**
   * Droit de lecture pour l'APERÇU admin : permet au formateur/admin
   * propriétaire de visionner la vidéo dans l'éditeur, sans passer par le
   * contrôle d'enrollment (réservé aux apprenants). La propriété est vérifiée.
   */
  async getLessonPlayback(user: AuthenticatedUser, lessonId: string) {
    await this.courseOfLesson(user, lessonId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    if (!lesson.streamVideoId) {
      throw new BadRequestException('Aucune vidéo associée à cette leçon');
    }
    return this.video.createPlaybackGrant(lesson.streamVideoId);
  }

  // ─────────────────────────── privé ───────────────────────────

  private assertOwnership(user: AuthenticatedUser, instructorId: string | null): void {
    if (user.role === UserRole.ADMIN) return;
    if (instructorId !== user.id) {
      throw new ForbiddenException("Cette formation ne vous appartient pas");
    }
  }

  private async getOwnedCourse(user: AuthenticatedUser, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Formation introuvable');
    this.assertOwnership(user, course.instructorId);
    return course;
  }

  private async courseOfModule(user: AuthenticatedUser, moduleId: string) {
    const mod = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: true },
    });
    if (!mod) throw new NotFoundException('Module introuvable');
    this.assertOwnership(user, mod.course.instructorId);
    return mod.course;
  }

  private async courseOfChapter(user: AuthenticatedUser, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { module: { include: { course: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    this.assertOwnership(user, chapter.module.course.instructorId);
    return chapter.module.course;
  }

  private async courseOfLesson(user: AuthenticatedUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { module: { include: { course: true } } } } },
    });
    if (!lesson) throw new NotFoundException('Leçon introuvable');
    this.assertOwnership(user, lesson.chapter.module.course.instructorId);
    return lesson.chapter.module.course;
  }

  /** Publication refusée si la formation ne contient aucune leçon exploitable. */
  private async assertPublishable(courseId: string): Promise<void> {
    const lessonCount = await this.prisma.lesson.count({
      where: { chapter: { module: { courseId } } },
    });
    if (lessonCount === 0) {
      throw new ConflictException('Impossible de publier une formation sans leçon');
    }
    const brokenVideos = await this.prisma.lesson.count({
      where: {
        chapter: { module: { courseId } },
        type: LessonType.VIDEO,
        OR: [{ streamVideoId: null }, { streamVideoId: '' }],
      },
    });
    if (brokenVideos > 0) {
      throw new ConflictException(
        `${brokenVideos} leçon(s) vidéo sans identifiant Cloudflare Stream — complétez-les avant de publier`,
      );
    }
  }

  private slugify(title: string): string {
    return title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // diacritiques
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private async uniqueSlug(base: string): Promise<string> {
    const slug = base || 'formation';
    const existing = await this.prisma.course.findMany({
      where: { slug: { startsWith: slug } },
      select: { slug: true },
    });
    if (!existing.some((c) => c.slug === slug)) return slug;
    let i = 2;
    const taken = new Set(existing.map((c) => c.slug));
    while (taken.has(`${slug}-${i}`)) i++;
    return `${slug}-${i}`;
  }
}
