import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { UsersModule } from '../users/users.module';
import { VideoModule } from '../video/video.module';
import { AdminAccessController } from './admin-access.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';

@Module({
  imports: [UsersModule, EnrollmentsModule, VideoModule],
  controllers: [AdminCatalogController, AdminAccessController],
  providers: [AdminCatalogService],
})
export class AdminModule {}
