import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';

import { ConsultantSkillExamService } from './consultant-skill-exam.service';

const SWEEP_BATCH_SIZE = 100;

/**
 * Background sweep that expires stale IN_PROGRESS skill exams whose 60-minute
 * deadline has passed.
 *
 * Why both lazy + sweep? The consultant API path (getDetail/submitAnswer/submit)
 * already expires the exam on next interaction, but a ghosting consultant who
 * never returns leaves the row IN_PROGRESS forever — the platform-wide expired
 * counter stops incrementing and the eligibility endpoint keeps reporting
 * `pending_exam`. The sweep guarantees the EXPIRED transition + counter update
 * fire reliably, with at most ~5 min of drift from the actual deadline.
 *
 * Idempotent: `expireExam()` short-circuits when the status is no longer
 * IN_PROGRESS, so a lazy expiry racing the sweep is safe.
 */
@Injectable()
export class SkillExamExpirySweeperService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly examService: ConsultantSkillExamService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(SkillExamExpirySweeperService.name, requestContext);
  }

  @Cron('*/5 * * * *') // every 5 min
  public async sweep(): Promise<void> {
    this.logger.log(`sweep — start`);
    const expired = await this.uow.consultantSkillExams.findExpiredInProgress(SWEEP_BATCH_SIZE);
    if (expired.length === 0) {
      this.logger.log(`sweep — complete | processed: 0`);
      return;
    }
    let processed = 0;
    for (const exam of expired) {
      try {
        await this.examService.expireExam(exam.id);
        processed += 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`sweep — expireExam failed | examId: ${exam.id} | error: ${msg}`);
      }
    }
    this.logger.log(`sweep — complete | processed: ${processed} / ${expired.length}`);
  }
}
