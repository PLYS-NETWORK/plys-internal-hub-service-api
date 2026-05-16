import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantExploreController } from './controllers/consultant-explore.controller';
import { ConsultantAccessService } from './services/consultant-access.service';
import { ConsultantExploreService } from './services/consultant-explore.service';

/**
 * Consultant-side projects surface, rebuilt feature-by-feature. Step 1 ships
 * the explore discovery feed only; overview / board are reintroduced as
 * separate features in later steps and will be wired in here.
 *
 * `RedisModule` and `I18nModule` are registered globally, so they are not
 * imported here even though `ConsultantExploreService` injects them.
 */
@Module({
  imports: [UnitOfWorkModule],
  controllers: [ConsultantExploreController],
  providers: [ConsultantAccessService, ConsultantExploreService],
})
export class ConsultantProjectsModule {}
