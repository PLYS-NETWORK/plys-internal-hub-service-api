import { JwtModule } from '@nestjs/jwt';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';

/** Register in the same `@Module` as controllers using `@UseGuards(PublicEndpointApiKeyGuard)`. */
export const gatewayBffGuardProviders = [PublicEndpointApiKeyGuard];

/** JwtModule + EnvironmentsModule for WebSocket gateways and validators. */
export const gatewayJwtAuthImports = [EnvironmentsModule, JwtModule.register({})];
