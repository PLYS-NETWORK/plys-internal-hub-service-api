import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

import { NOTIFICATION_TYPES } from '../enums/notification-type.enum';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';
import {
  ISkillMatchJobPayload,
  SKILL_MATCH_NOTIFICATION_JOBS,
  SKILL_MATCH_NOTIFICATION_QUEUE,
} from './skill-match-notification.constants';

const BATCH_SIZE = 100;

@Processor(SKILL_MATCH_NOTIFICATION_QUEUE)
export class SkillMatchNotificationProcessor {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(SkillMatchNotificationProcessor.name, requestContext);
  }

  @Process(SKILL_MATCH_NOTIFICATION_JOBS.DISPATCH_MATCHING_CONSULTANTS)
  public async handleDispatchMatchingConsultants(job: Job<ISkillMatchJobPayload>): Promise<void> {
    const { project_id, project_code, project_title, business_id, required_skill_ids } = job.data;

    this.logger.log(
      `[${this.rid}] handleDispatchMatchingConsultants — start | projectId: ${project_id} | skillCount: ${required_skill_ids.length}`,
    );

    if (required_skill_ids.length === 0) return;

    let offset = 0;
    let totalDispatched = 0;

    // Process consultants in batches to avoid loading all matching rows into memory.
    while (true) {
      const userIds = await this.uow.consultantProfiles.findUserIdsBySkillIds(
        required_skill_ids,
        offset,
        BATCH_SIZE,
      );

      if (userIds.length === 0) break;

      const results = await Promise.allSettled(
        userIds.map((userId) =>
          this.dispatcher.dispatch({
            userId,
            type: NOTIFICATION_TYPES.CONSULTANT_PROJECT_SKILL_MATCH,
            metadata: { project_id, project_code, project_title, business_id },
          }),
        ),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        this.logger.warn(
          `[${this.rid}] handleDispatchMatchingConsultants — batch partial failure | offset: ${offset} | failed: ${failed}`,
        );
      }

      totalDispatched += userIds.length - failed;
      offset += BATCH_SIZE;

      if (userIds.length < BATCH_SIZE) break;
    }

    this.logger.log(
      `[${this.rid}] handleDispatchMatchingConsultants — complete | projectId: ${project_id} | dispatched: ${totalDispatched}`,
    );
  }
}
