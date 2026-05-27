import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ITaskAiReviewRequestedEvent,
  NOTIFICATION_EVENTS,
} from '@plys/libraries/common-nest/events';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { TaskKanbanStatus } from '@plys/libraries/database/enums';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';

import { AiQualityCheckService } from '../services/ai-quality-check.service';
import { TaskCompletionService } from '../services/task-completion.service';

/**
 * Decoupled AI gate: fired by `TaskReviewVotingService` after both initial
 * reviewers vote PASS. Runs asynchronously so the reviewer-facing HTTP
 * request returns instantly and the AI call doesn't hold a DB lock.
 *
 * Idempotency: keyed on (task_id, round_number). The handler re-checks the
 * task's current status; if it's no longer in PENDING_APPROVAL (e.g. another
 * duplicate event resolved it), the run is a no-op.
 */
@Injectable()
export class TaskAiReviewHandler {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly aiQualityCheck: AiQualityCheckService,
    private readonly completion: TaskCompletionService,
  ) {
    this.logger = new AppLogger(TaskAiReviewHandler.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  @OnEvent(NOTIFICATION_EVENTS.TASK_AI_REVIEW_REQUESTED, { async: true })
  public async handleAiReviewRequested(event: ITaskAiReviewRequestedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] handleAiReviewRequested — start | taskId: ${event.task_id}, round: ${event.round_number}`,
    );

    try {
      const task = await this.uow.tasks.findOne({ where: { id: event.task_id } });
      if (!task) {
        this.logger.warn(
          `[${this.rid}] handleAiReviewRequested — task missing | taskId: ${event.task_id}`,
        );
        return;
      }
      // Idempotency guard: only proceed when task is still parked at PENDING_APPROVAL
      // for the round this event was emitted for.
      if (
        task.kanbanStatus !== TaskKanbanStatus.PENDING_APPROVAL ||
        task.lastReviewRound !== event.round_number
      ) {
        this.logger.warn(
          `[${this.rid}] handleAiReviewRequested — stale event | taskId: ${event.task_id}, status: ${task.kanbanStatus}, round: ${task.lastReviewRound}/${event.round_number}`,
        );
        return;
      }

      const result = await this.aiQualityCheck.evaluate({
        taskId: event.task_id,
        roundNumber: event.round_number,
      });

      if (result.decision === 'pass') {
        await this.completion.markDone(event.task_id);
      } else {
        const summary =
          result.feedback?.trim() || 'AI quality check flagged the deliverable for revision.';
        await this.completion.markRevisionRequested(event.task_id, summary);
      }

      this.logger.log(
        `[${this.rid}] handleAiReviewRequested — complete | taskId: ${event.task_id}, decision: ${result.decision}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] handleAiReviewRequested — failed | taskId: ${event.task_id} | error: ${message}`,
      );
      // Swallow — event handler is fire-and-forget. On failure the task is
      // stuck in PENDING_APPROVAL until an admin retries or resolves it.
    }
  }
}
