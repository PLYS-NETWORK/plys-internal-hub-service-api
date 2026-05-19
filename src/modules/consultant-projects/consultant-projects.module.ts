import { TaskReviewsModule } from '@modules/task-reviews/task-reviews.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantExploreController } from './controllers/consultant-explore.controller';
import { ConsultantJoinedProjectsController } from './controllers/consultant-joined-projects.controller';
import { ConsultantMembershipController } from './controllers/consultant-membership.controller';
import { ConsultantProjectTasksController } from './controllers/consultant-project-tasks.controller';
import { ConsultantAccessService } from './services/consultant-access.service';
import { ConsultantExploreService } from './services/consultant-explore.service';
import { ConsultantJoinedCacheService } from './services/consultant-joined-cache.service';
import { ConsultantJoinedProjectsService } from './services/consultant-joined-projects.service';
import { ConsultantMembershipService } from './services/consultant-membership.service';
import { ConsultantProjectTasksService } from './services/consultant-project-tasks.service';

/**
 * Consultant-side projects surface, rebuilt feature-by-feature. Step 1
 * shipped the explore discovery feed; step 2 added membership writes
 * (apply / leave); step 3 adds the joined-project surface (workspace
 * switcher, joined list, joined detail) and task-level operations
 * (list, assign, unassign, submit-for-review).
 *
 * `RedisModule` and `I18nModule` are registered globally, so they are not
 * imported here even though the services inject them.
 */
@Module({
  imports: [UnitOfWorkModule, TaskReviewsModule],
  controllers: [
    ConsultantExploreController,
    ConsultantJoinedProjectsController,
    ConsultantMembershipController,
    ConsultantProjectTasksController,
  ],
  providers: [
    ConsultantAccessService,
    ConsultantExploreService,
    ConsultantJoinedCacheService,
    ConsultantJoinedProjectsService,
    ConsultantMembershipService,
    ConsultantProjectTasksService,
  ],
})
export class ConsultantProjectsModule {}
