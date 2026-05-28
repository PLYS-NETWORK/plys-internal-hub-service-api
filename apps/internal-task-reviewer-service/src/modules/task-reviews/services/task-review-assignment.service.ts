import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ITaskReviewerReviewAssignedEvent,
  NOTIFICATION_EVENTS,
} from '@plys/libraries/common-nest/events';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientService } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { TaskReview } from '@plys/libraries/database/entities';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';

import { ERROR_CODES } from '../../../errors/error-codes';
import { ITaskReviewAssignmentService } from '../interfaces/task-review-assignment.service.interface';

const INITIAL_REVIEWER_COUNT = 2;

@Injectable()
export class TaskReviewAssignmentService implements ITaskReviewAssignmentService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly notificationsClient: NotificationsClientService,
  ) {
    this.logger = new AppLogger(TaskReviewAssignmentService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async assignInitialReviewers(taskId: string): Promise<void> {
    this.logger.log(`[${this.rid}] assignInitialReviewers — start | taskId: ${taskId}`);

    const created = await this.uow.withTransaction(async (tx) => {
      const task = await tx.tasks.findOne({ where: { id: taskId } });
      if (!task) {
        // Defensive: the caller validated the task exists, but in race scenarios
        // (cancellation in flight) this can still happen.
        this.logger.warn(`[${this.rid}] assignInitialReviewers — task missing | taskId: ${taskId}`);
        return [] as TaskReview[];
      }

      const reviewerIds = await tx.tasks.pickEligibleReviewers(taskId, INITIAL_REVIEWER_COUNT, []);
      if (reviewerIds.length < INITIAL_REVIEWER_COUNT) {
        this.logger.error(
          `[${this.rid}] assignInitialReviewers — insufficient reviewers | taskId: ${taskId}, found: ${reviewerIds.length}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task_review.insufficient_reviewers',
          errorCode: ERROR_CODES.TASK_REVIEW_INSUFFICIENT_REVIEWERS,
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
      }

      return tx.taskReviews.createBatch(
        reviewerIds.map((reviewerId) => ({
          taskId,
          reviewerId,
          roundNumber: task.lastReviewRound,
          isArbiter: false,
        })),
      );
    });

    await this.fanOutAssignmentEvents(created, false);
    this.logger.log(
      `[${this.rid}] assignInitialReviewers — complete | taskId: ${taskId}, count: ${created.length}`,
    );
  }

  /** @inheritdoc */
  public async assignArbiter(taskId: string, roundNumber: number): Promise<void> {
    this.logger.log(
      `[${this.rid}] assignArbiter — start | taskId: ${taskId}, round: ${roundNumber}`,
    );

    const created = await this.uow.withTransaction(async (tx) => {
      // Exclude reviewers already on this round to keep the unique constraint
      // (task_id, reviewer_id, round_number) happy.
      const existing = await tx.taskReviews.findByTaskAndRound(taskId, roundNumber);
      const excludeIds = existing.map((r) => r.reviewerId);

      const reviewerIds = await tx.tasks.pickEligibleReviewers(taskId, 1, excludeIds);
      if (reviewerIds.length === 0) {
        this.logger.error(`[${this.rid}] assignArbiter — no arbiter available | taskId: ${taskId}`);
        throw new TranslatableException({
          messageKey: 'error.task_review.insufficient_reviewers',
          errorCode: ERROR_CODES.TASK_REVIEW_INSUFFICIENT_REVIEWERS,
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
      }

      return tx.taskReviews.createBatch([
        {
          taskId,
          reviewerId: reviewerIds[0],
          roundNumber,
          isArbiter: true,
        },
      ]);
    });

    await this.fanOutAssignmentEvents(created, true);
    this.logger.log(
      `[${this.rid}] assignArbiter — complete | taskId: ${taskId}, reviewerId: ${created[0]?.reviewerId ?? 'n/a'}`,
    );
  }

  /** @inheritdoc */
  public async voidActiveReviews(taskId: string, roundNumber: number): Promise<number> {
    this.logger.log(
      `[${this.rid}] voidActiveReviews — start | taskId: ${taskId}, round: ${roundNumber}`,
    );
    const count = await this.uow.taskReviews.voidPendingByTaskAndRound(taskId, roundNumber);
    this.logger.log(
      `[${this.rid}] voidActiveReviews — complete | taskId: ${taskId}, voided: ${count}`,
    );
    return count;
  }

  private async fanOutAssignmentEvents(rows: TaskReview[], isArbiter: boolean): Promise<void> {
    if (rows.length === 0) return;
    // Hydrate task fields for the event payload — re-read once to avoid N+1.
    const taskId = rows[0].taskId;
    const task = await this.uow.tasks.findOne({ where: { id: taskId } });
    if (!task) return;

    for (const row of rows) {
      const payload: ITaskReviewerReviewAssignedEvent = {
        review_id: row.id,
        task_id: task.id,
        task_code: task.code,
        task_title: task.title,
        project_id: task.projectId,
        round_number: row.roundNumber,
        is_arbiter: row.isArbiter || isArbiter,
        reviewer_user_id: row.reviewerId,
      };
      this.notificationsClient.emit(NOTIFICATION_EVENTS.TASK_REVIEWER_REVIEW_ASSIGNED, payload);
    }
  }
}
