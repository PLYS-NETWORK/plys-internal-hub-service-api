import { Global, Module } from '@nestjs/common';

import { EnvironmentsModule } from '../environments';
import { NotificationRealtimeEmitterService } from './notification-realtime-emitter.service';

@Global()
@Module({
  imports: [EnvironmentsModule],
  providers: [NotificationRealtimeEmitterService],
  exports: [NotificationRealtimeEmitterService],
})
export class NotificationRealtimeModule {}
