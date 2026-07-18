import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../notifications/realtime.gateway';

const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
} as const;

/**
 * Messagerie privée 1-à-1 (Vol 2 §24, itération 1 — polling côté client ;
 * le temps réel Socket.IO arrivera avec le centre de notifications).
 * Confidentialité : seuls les participants accèdent à une conversation,
 * et l'annuaire n'expose jamais les emails.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ─────────────────────────── Annuaire ───────────────────────────

  async searchContacts(userId: string, query?: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        status: UserStatus.ACTIVE,
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      take: 20,
      select: CONTACT_SELECT,
    });
  }

  // ─────────────────────────── Conversations ───────────────────────────

  async listConversations(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: CONTACT_SELECT } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    const rows = await Promise.all(
      participations.map(async (p) => {
        const other = p.conversation.participants.find((x) => x.userId !== userId);
        const last = p.conversation.messages[0] ?? null;
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: p.conversationId,
            createdAt: { gt: p.lastReadAt },
            authorId: { not: userId },
          },
        });
        return {
          id: p.conversationId,
          contact: other?.user ?? null,
          lastMessage: last
            ? { content: last.content, createdAt: last.createdAt, isMine: last.authorId === userId }
            : null,
          unreadCount,
          updatedAt: p.conversation.updatedAt,
        };
      }),
    );

    return rows
      .filter((r) => r.contact)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /** Ouvre (ou crée) la conversation 1-à-1 avec un destinataire. */
  async openConversation(userId: string, recipientId: string) {
    if (recipientId === userId) {
      throw new BadRequestException('Impossible de converser avec soi-même');
    }
    const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Destinataire introuvable');
    }

    // Conversation existante contenant exactement ces deux participants
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
    });
    if (existing) return { id: existing.id };

    const conversation = await this.prisma.conversation.create({
      data: {
        participants: { create: [{ userId }, { userId: recipientId }] },
      },
    });
    return { id: conversation.id };
  }

  // ─────────────────────────── Messages ───────────────────────────

  /** Fil (50 derniers) + marquage lu à l'ouverture. */
  async getThread(userId: string, conversationId: string) {
    const participant = await this.assertParticipant(userId, conversationId);

    const [messages, participants] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { author: { select: CONTACT_SELECT } },
      }),
      this.prisma.conversationParticipant.findMany({
        where: { conversationId },
        include: { user: { select: CONTACT_SELECT } },
      }),
    ]);

    await this.prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: new Date() },
    });

    return {
      id: conversationId,
      contact: participants.find((p) => p.userId !== userId)?.user ?? null,
      messages: messages.reverse(), // ordre chronologique pour l'affichage
    };
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    await this.assertParticipant(userId, conversationId);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, authorId: userId, content },
        include: { author: { select: CONTACT_SELECT } },
      }),
      // Fait remonter la conversation en tête de liste
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      // Mon propre envoi ne doit pas compter comme non-lu pour moi
      this.prisma.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { lastReadAt: new Date() },
      }),
    ]);

    // Livraison instantanée aux autres participants connectés
    const others = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    });
    for (const other of others) {
      this.realtime.emitToUser(other.userId, 'message', {
        conversationId,
        from: `${message.author.firstName} ${message.author.lastName}`.trim(),
        preview: message.content.slice(0, 80),
      });
    }

    return message;
  }

  /** Total de non-lus (badge de navigation). */
  async unreadCount(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    });
    if (participations.length === 0) return { unread: 0 };

    const counts = await Promise.all(
      participations.map((p) =>
        this.prisma.message.count({
          where: {
            conversationId: p.conversationId,
            createdAt: { gt: p.lastReadAt },
            authorId: { not: userId },
          },
        }),
      ),
    );
    return { unread: counts.reduce((a, b) => a + b, 0) };
  }

  // ─────────────────────────── privé ───────────────────────────

  private async assertParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException("Vous ne participez pas à cette conversation");
    }
    return participant;
  }
}
