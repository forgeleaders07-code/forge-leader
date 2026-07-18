import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Centre de notifications (Vol 2 §26).
 * `notify` est la porte d'entrée UNIQUE des autres modules : persiste,
 * puis pousse en temps réel via la room de l'utilisateur.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async notify(userId: string, input: NotifyInput): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? '',
        link: input.link ?? '',
      },
    });
    this.realtime.emitToUser(userId, 'notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      createdAt: notification.createdAt,
    });
  }

  async notifyMany(userIds: string[], input: NotifyInput): Promise<void> {
    // Volumes actuels : séquentiel simple ; passera par une file (BullMQ)
    // quand les cohortes dépasseront quelques milliers de membres.
    for (const userId of userIds) {
      await this.notify(userId, input);
    }
  }

  async list(userId: string, cursor?: string, limit = 30) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = notifications.length > limit;
    const page = hasMore ? notifications.slice(0, limit) : notifications;
    return { notifications: page, nextCursor: hasMore ? page[page.length - 1].id : null };
  }

  async unreadCount(userId: string) {
    const unread = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unread };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable');
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
