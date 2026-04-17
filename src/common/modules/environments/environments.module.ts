import { Global, Module } from '@nestjs/common';

import { EnvironmentsService } from './environments.service';

@Global()
@Module({
  providers: [EnvironmentsService],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
