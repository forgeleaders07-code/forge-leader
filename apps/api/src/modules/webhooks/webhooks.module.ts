import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { UsersModule } from '../users/users.module';
import { SystemeIoWebhookController } from './systeme-io.controller';
import { SystemeIoWebhookService } from './systeme-io.service';

@Module({
  imports: [UsersModule, EnrollmentsModule, AuthModule],
  controllers: [SystemeIoWebhookController],
  providers: [SystemeIoWebhookService],
})
export class WebhooksModule {}
