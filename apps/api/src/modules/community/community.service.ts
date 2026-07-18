import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, ReactionType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { NotificationsService } from '../notifications/notifications.service';

const REACTION_LABELS: Record<ReactionType, string> = {
  LIKE: 'aimé',
  LOVE: 'adoré',
  CLAP: 'applaudi',
  INSIGHT: 'trouvé éclairante',
};

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
} as const;

/**
 * Communauté du campus (Vol 2 §23) — fil unique réservé aux membres
 * authentifiés. Modération : chacun supprime ses contenus, l'ADMIN
 * supprime tout.
 */
@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─────────────────────────── Fil ───────────────────────────

  async getFeed(userId: string, cursor?: string, limit = 20) {
    const posts = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // +1 pour savoir s'il reste une page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { select: AUTHOR_SELECT },
        reactions: { select: { type: true, userId: true } },
        _count: { select: { comments: true } },
      },
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;

    return {
      posts: page.map((p) => this.toPostDto(p, userId)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async createPost(userId: string, content: string) {
    const post = await this.prisma.post.create({
      data: { authorId: userId, content: content.trim() },
      include: {
        author: { select: AUTHOR_SELECT },
        reactions: { select: { type: true, userId: true } },
        _count: { select: { comments: true } },
      },
    });
    return this.toPostDto(post, userId);
  }

  async deletePost(user: AuthenticatedUser, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publication introuvable');
    this.assertCanModerate(user, post.authorId);
    await this.prisma.post.delete({ where: { id: postId } });
  }

  // ─────────────────────────── Commentaires ───────────────────────────

  async listComments(postId: string) {
    await this.getPostOrThrow(postId);
    return this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async createComment(userId: string, postId: string, content: string) {
    const post = await this.getPostOrThrow(postId);
    const comment = await this.prisma.comment.create({
      data: { postId, authorId: userId, content: content.trim() },
      include: { author: { select: AUTHOR_SELECT } },
    });

    if (post.authorId !== userId) {
      await this.notifications.notify(post.authorId, {
        type: NotificationType.COMMENT,
        title: `${comment.author.firstName} ${comment.author.lastName} a commenté votre publication`,
        body: comment.content.slice(0, 120),
        link: '/communaute',
      });
    }
    return comment;
  }

  async deleteComment(user: AuthenticatedUser, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    this.assertCanModerate(user, comment.authorId);
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  // ─────────────────────────── Réactions ───────────────────────────

  /** Pose ou remplace ma réaction ; re-cliquer le même type la retire. */
  async react(userId: string, postId: string, type: ReactionType) {
    const post = await this.getPostOrThrow(postId);

    const existing = await this.prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing?.type === type) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return { myReaction: null };
    }

    await this.prisma.reaction.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, type },
      update: { type },
    });

    // Nouvelle réaction (pas un simple changement) → notifier l'auteur
    if (!existing && post.authorId !== userId) {
      const reactor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      await this.notifications.notify(post.authorId, {
        type: NotificationType.REACTION,
        title: `${reactor?.firstName ?? 'Un membre'} ${reactor?.lastName ?? ''} a ${REACTION_LABELS[type]} votre publication`.trim(),
        link: '/communaute',
      });
    }
    return { myReaction: type };
  }

  // ─────────────────────────── privé ───────────────────────────

  private async getPostOrThrow(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publication introuvable');
    return post;
  }

  private assertCanModerate(user: AuthenticatedUser, authorId: string): void {
    if (user.role !== UserRole.ADMIN && user.id !== authorId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres contenus');
    }
  }

  private toPostDto(
    post: {
      id: string;
      content: string;
      createdAt: Date;
      author: { id: string; firstName: string; lastName: string; role: UserRole; avatarUrl: string | null };
      reactions: { type: ReactionType; userId: string }[];
      _count: { comments: number };
    },
    viewerId: string,
  ) {
    const reactionCounts: Record<string, number> = {};
    for (const r of post.reactions) {
      reactionCounts[r.type] = (reactionCounts[r.type] ?? 0) + 1;
    }
    return {
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      author: post.author,
      commentCount: post._count.comments,
      reactionCounts,
      myReaction: post.reactions.find((r) => r.userId === viewerId)?.type ?? null,
    };
  }
}
