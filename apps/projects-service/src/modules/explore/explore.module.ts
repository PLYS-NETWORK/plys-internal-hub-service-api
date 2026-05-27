import { Module } from '@nestjs/common';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { ExploreService } from './services/explore.service';

/**
 * Public, BFF-facing explore surface. All routes share the
 * {@link PublicEndpointApiKeyGuard} (controller-scoped) and skip JwtAuthGuard
 * via `@Public()`. RedisModule and EnvironmentsModule are registered globally
 * so they do not need to be imported here.
 */
@Module({
  imports: [ProjectsUnitOfWorkModule],
  controllers: [],
  providers: [PublicEndpointApiKeyGuard, ExploreService],
})
export class ExploreModule {}
