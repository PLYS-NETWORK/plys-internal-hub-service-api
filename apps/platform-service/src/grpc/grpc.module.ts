import { FilesModule } from '@modules/files';
import { HealthModule } from '@modules/health/health.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SkillsModule } from '@modules/skills/skills.module';
import { StatisticsModule } from '@modules/statistics/statistics.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [FilesModule, SkillsModule, StatisticsModule, NotificationsModule, HealthModule],
})
export class GrpcModule {}
