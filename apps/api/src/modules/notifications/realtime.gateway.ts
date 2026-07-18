import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/types/authenticated-user';

/**
 * Passerelle temps réel unique de la plateforme (Socket.IO).
 * Chaque client s'authentifie avec son access token JWT au handshake,
 * puis rejoint sa room personnelle `user:{id}` — les modules émettent
 * vers cette room (notifications, messages) sans connaître les sockets.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers.authorization ?? '').replace(/^Bearer /, '');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      await client.join(`user:${payload.sub}`);
    } catch {
      this.logger.warn('Connexion WebSocket refusée (token invalide)');
      client.disconnect(true);
    }
  }

  /** Émet un événement vers UN utilisateur (toutes ses sessions ouvertes). */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
