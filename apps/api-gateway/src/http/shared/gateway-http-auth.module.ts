import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';

/**
 * Shared auth wiring for api-gateway HTTP feature modules.
 * Controllers/guards registered in a feature module cannot rely on AppModule
 * imports alone — JwtModule and module-scoped guards must be imported here.
 */
@Module({
  imports: [EnvironmentsModule, JwtModule.register({})],
  providers: [PublicEndpointApiKeyGuard],
  exports: [EnvironmentsModule, JwtModule, PublicEndpointApiKeyGuard],
})
export class GatewayHttpAuthModule {}
