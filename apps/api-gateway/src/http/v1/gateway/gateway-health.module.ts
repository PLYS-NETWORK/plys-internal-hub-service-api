import { Module } from '@nestjs/common';

import { GatewayHealthController } from './gateway-health.controller';

@Module({
  controllers: [GatewayHealthController],
})
export class GatewayHealthModule {}
