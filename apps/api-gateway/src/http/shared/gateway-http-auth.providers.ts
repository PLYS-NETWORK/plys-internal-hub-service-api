import { JwtModule } from '@nestjs/jwt';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';

/**
 * Nest resolves `@UseGuards(SomeGuard)` in the controller's module. Exported guards
 * from an imported module are not enough — register these in the same `@Module`
 * that declares the controller.
 */
export const gatewayBffGuardImports = [EnvironmentsModule];

export const gatewayBffGuardProviders = [PublicEndpointApiKeyGuard];

/** JwtModule + EnvironmentsModule for WebSocket gateways and validators. */
export const gatewayJwtAuthImports = [EnvironmentsModule, JwtModule.register({})];
