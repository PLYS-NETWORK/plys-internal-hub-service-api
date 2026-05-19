import { ERROR_CODES } from '@common/constants/error-codes';
import { ITaskAiReviewRequestedEvent, NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskKanbanStatus, TaskReviewDecision } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  ISubmitVoteParams,
  ITaskReviewVotingService,
} from '../interfaces/task-review-voting.service.interface';
import { TaskCompletionService } from './task-completion.service';
import { TaskReviewAssignmentService } from './task-review-assignment.service';

type ResolutionAction =
  | { kind: 'noop' }
  | { kind: 'request_ai'; taskId: string; roundNumber: number }
  | { kind: 'assign_arbiter'; taskId: string; roundNumber: number }
  | { kind: 'revision'; taskId: string; feedbackSummary: string };

@Injectable()
export class TaskReviewVotingService implements ITaskReviewVotingService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly eventEmitter: EventEmitter2,
    private readonly assignment: TaskReviewAssignmentService,
    private readonly completion: TaskCompletionService,
  ) {
    this.logger = new AppLogger(TaskReviewVotingService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async submitVote(reviewId: string, params: ISubmitVoteParams): Promise<void> {
    const callerId = this.requestContext.userId;
    if (!callerId) {
      throw new TranslatableException({
        messageKey: 'error.generic.unauthorized',
        errorCode: ERROR_CODES.GENERIC_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    if (
      params.decision !== TaskReviewDecision.PASS &&
      params.decision !== TaskReviewDecision.FAIL
    ) {
      throw new TranslatableException({
        messageKey: 'error.task_review.invalid_decision',
        errorCode: ERROR_CODES.TASK_REVIEW_INVALID_DECISION,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    this.logger.log(
      `[${this.rid}] submitVote — start | reviewId: ${reviewId}, decision: ${params.decision}`,
    );

    const action = await this.uow.withTransaction<ResolutionAction>(async (tx) => {
      const review = await tx.taskReviews.findByIdWithLock(reviewId);
      if (!review) {
        throw new TranslatableException({
          messageKey: 'error.task_review.not_found',
          errorCode: ERROR_CODES.TASK_REVIEW_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (review.reviewerId !== callerId) {
        throw new TranslatableException({
          messageKey: 'error.task_review.forbidden',
          errorCode: ERROR_CODES.TASK_REVIEW_FORBIDDEN,
          status: HttpStatus.FORBIDDEN,
        });
      }
      if (review.decision !== TaskReviewDecision.PENDING) {
        throw new TranslatableException({
          messageKey: 'error.task_review.already_voted',
          errorCode: ERROR_CODES.TASK_REVIEW_ALREADY_VOTED,
          status: HttpStatus.CONFLICT,
        });
      }

      // Re-lock the task row inside the same tx to serialise vote-resolution.
      const lockedTask = await tx.tasks.lockTaskForReview(review.taskId, [
        TaskKanbanStatus.IN_REVIEW,
      ]);
      if (!lockedTask) {
        throw new TranslatableException({
          messageKey: 'error.task_review.round_closed',
          errorCode: ERROR_CODES.TASK_REVIEW_ROUND_CLOSED,
          status: HttpStatus.CONFLICT,
        });
      }
      if (lockedTask.lastReviewRound !== review.roundNumber) {
        throw new TranslatableException({
          messageKey: 'error.task_review.round_closed',
          errorCode: ERROR_CODES.TASK_REVIEW_ROUND_CLOSED,
          status: HttpStatus.CONFLICT,
        });
      }

      await tx.taskReviews.recordVote(review.id, params.decision, params.feedback?.trim() || null);

      const tally = await tx.taskReviews.tallyDecisions(review.taskId, review.roundNumber);
      const allRows = await tx.taskReviews.findByTaskAndRound(review.taskId, review.roundNumber);
      const totalDecided = tally.pass + tally.fail;
      const totalAssigned = allRows.length;
      const arbiterRow = allRows.find((r) => r.isArbiter);

      // ── 2 initial votes complete (no arbiter yet) ───────────────────────────
      if (totalAssigned === 2 && totalDecided === 2) {
        if (tally.pass === 2) {
          // Both PASS → run the AI gate via async handler.
          lockedTask.kanbanStatus = TaskKanbanStatus.PENDING_APPROVAL;
          await tx.tasks.save(lockedTask);
          return {
            kind: 'request_ai',
            taskId: review.taskId,
            roundNumber: review.roundNumber,
          };
        }
        if (tally.fail === 2) {
          // Both FAIL → straight to REVISION_REQUESTED.
          return {
            kind: 'revision',
            taskId: review.taskId,
            feedbackSummary: this.buildFeedbackSummary(allRows),
          };
        }
        // 1 PASS + 1 FAIL → bring in the Arbiter.
        return {
          kind: 'assign_arbiter',
          taskId: review.taskId,
          roundNumber: review.roundNumber,
        };
      }

      // ── Arbiter has voted (3 rows present, 3 decided) ───────────────────────
      if (arbiterRow && arbiterRow.decision !== TaskReviewDecision.PENDING && totalDecided === 3) {
        // Per the 3+1 rule: any split that required an arbiter ALWAYS resolves
        // to REVISION_REQUESTED, regardless of the arbiter's verdict.
        return {
          kind: 'revision',
          taskId: review.taskId,
          feedbackSummary: this.buildFeedbackSummary(allRows),
        };
      }

      return { kind: 'noop' };
    });

    // Side-effects AFTER the vote tx commits.
    switch (action.kind) {
      case 'request_ai': {
        const payload: ITaskAiReviewRequestedEvent = {
          task_id: action.taskId,
          round_number: action.roundNumber,
        };
        this.eventEmitter.emit(NOTIFICATION_EVENTS.TASK_AI_REVIEW_REQUESTED, payload);
        break;
      }
      case 'assign_arbiter':
        await this.assignment.assignArbiter(action.taskId, action.roundNumber);
        break;
      case 'revision':
        await this.completion.markRevisionRequested(action.taskId, action.feedbackSummary);
        break;
      case 'noop':
      default:
        break;
    }

    this.logger.log(
      `[${this.rid}] submitVote — complete | reviewId: ${reviewId}, action: ${action.kind}`,
    );
  }

  private buildFeedbackSummary(
    rows: ReadonlyArray<{
      feedback: string | null;
      isArbiter: boolean;
      decision: TaskReviewDecision;
    }>,
  ): string {
    const lines = rows
      .filter((r) => r.decision !== TaskReviewDecision.PENDING && r.feedback)
      .map((r, idx) => {
        const label = r.isArbiter ? 'Arbiter' : `Reviewer ${idx + 1}`;
        return `${label} (${r.decision.toUpperCase()}): ${r.feedback}`;
      });
    return lines.length > 0 ? lines.join('\n') : 'No additional feedback provided.';
  }
}
