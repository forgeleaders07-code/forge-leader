import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { UsersModule } from '../users/users.module';
import { VideoModule } from '../video/video.module';
import { AdminAccessController } from './admin-access.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminStatsService } from './admin-stats.service';

@Module({
  imports: [UsersModule, EnrollmentsModule, VideoModule, AuthModule],
  controllers: [AdminCatalogController, AdminAccessController],
  providers: [AdminCatalogService, AdminStatsService],
})
export class AdminModule {}
