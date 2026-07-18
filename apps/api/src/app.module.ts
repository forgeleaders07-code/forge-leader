import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AdminModule } from './modules/admin/admin.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CommunityModule } from './modules/community/community.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { MailModule } from './modules/mail/mail.module';
import { VideoModule } from './modules/video/video.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Anti brute-force global : 100 requêtes / minute / IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    EnrollmentsModule,
    VideoModule,
    WebhooksModule,
    AdminModule,
    QuizModule,
    CertificatesModule,
    DashboardModule,
    CommunityModule,
    MessagingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Toute route est protégée par défaut ; l'ouverture est explicite via @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
