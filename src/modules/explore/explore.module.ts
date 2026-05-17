import { PublicEndpointApiKeyGuard } from '@common/guards/public-endpoint-api-key.guard';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ExploreController } from './explore.controller';
import { ExploreService } from './services/explore.service';

/**
 * Public, BFF-facing explore surface. All routes share the
 * {@link PublicEndpointApiKeyGuard} (controller-scoped) and skip JwtAuthGuard
 * via `@Public()`. RedisModule and EnvironmentsModule are registered globally
 * so they do not need to be imported here.
 */
@Module({
  imports: [UnitOfWorkModule],
  controllers: [ExploreController],
  providers: [PublicEndpointApiKeyGuard, ExploreService],
})
export class ExploreModule {}
