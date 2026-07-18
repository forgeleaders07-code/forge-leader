import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Global : tout module métier peut injecter NotificationsService
 * (et RealtimeGateway pour les événements purs comme les messages).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [RealtimeGateway, NotificationsService],
  exports: [NotificationsService, RealtimeGateway],
})
export class NotificationsModule {}
