import { NotificationsModule } from '@modules/notifications/notifications.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [NotificationsModule],
})
export class GrpcModule {}
