import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantExploreController } from './controllers/consultant-explore.controller';
import { ConsultantMembershipController } from './controllers/consultant-membership.controller';
import { ConsultantAccessService } from './services/consultant-access.service';
import { ConsultantExploreService } from './services/consultant-explore.service';
import { ConsultantMembershipService } from './services/consultant-membership.service';

/**
 * Consultant-side projects surface, rebuilt feature-by-feature. Step 1
 * shipped the explore discovery feed; step 2 adds the membership writes
 * (apply / leave). Overview / board come back in later steps.
 *
 * `RedisModule` and `I18nModule` are registered globally, so they are not
 * imported here even though the services inject them.
 */
@Module({
  imports: [UnitOfWorkModule],
  controllers: [ConsultantExploreController, ConsultantMembershipController],
  providers: [ConsultantAccessService, ConsultantExploreService, ConsultantMembershipService],
})
export class ConsultantProjectsModule {}
