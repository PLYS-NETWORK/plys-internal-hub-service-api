import { ERROR_CODES } from '@common/constants/error-codes';
import { ITaskStatusChangedEvent, NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Task } from '@database/entities';
import {
  ConsultantTransactionType,
  TaskDisputeStatus,
  TaskKanbanStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ITaskCompletionService } from '../interfaces/task-completion.service.interface';

const REVISION_CAP = 3;

@Injectable()
export class TaskCompletionService implements ITaskCompletionService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(TaskCompletionService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async markDone(taskId: string): Promise<void> {
    this.logger.log(`[${this.rid}] markDone — start | taskId: ${taskId}`);

    const result = await this.uow.withTransaction(async (tx) => {
      const locked = await tx.tasks.lockTaskForReview(taskId, [
        TaskKanbanStatus.IN_REVIEW,
        TaskKanbanStatus.PENDING_APPROVAL,
      ]);
      if (!locked) {
        this.logger.warn(
          `[${this.rid}] markDone — task not found or wrong status | taskId: ${taskId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task.not_found',
          errorCode: ERROR_CODES.TASK_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (!locked.assignedTo) {
        throw new TranslatableException({
          messageKey: 'error.task.not_owned_by_consultant',
          errorCode: ERROR_CODES.TASK_NOT_OWNED_BY_CONSULTANT,
          status: HttpStatus.CONFLICT,
        });
      }

      const previousStatus = locked.kanbanStatus;
      const now = new Date();
      locked.kanbanStatus = TaskKanbanStatus.DONE;
      locked.completedAt = now;
      locked.approvedAt = now;
      const saved = await tx.tasks.save(locked);

      // Resolve consultant user id for the event payload.
      const consultantProfile = await tx.consultantProfiles.findOne({
        where: { id: saved.assignedTo! },
      });
      const consultantUserId = consultantProfile?.userId ?? null;

      // Insert the CREDIT_CLEARED ledger row and increment the wallet in the
      // same transaction so a partial commit can never leave a paid task
      // without a payout row, nor a payout row without a balance change.
      const payoutAmount = this.normalisePayout(saved.consultantPayout);
      const transactionNumber = await tx.transactionNumbers.next(
        'LN',
        ConsultantTransactionType.CREDIT_CLEARED,
      );
      const txn = tx.consultantTransactions.create({
        transactionNumber,
        consultantId: saved.assignedTo!,
        type: ConsultantTransactionType.CREDIT_CLEARED,
        amount: payoutAmount,
        status: TransactionStatus.COMPLETED,
        taskId: saved.id,
        projectId: saved.projectId,
        note: `Task ${saved.code} approved via 3+1 review`,
      });
      await tx.consultantTransactions.save(txn);

      await tx.consultantProfiles.incrementAccountBalance(saved.assignedTo!, payoutAmount);

      // Resolve business user id for the cross-platform task-status event.
      const project = await tx.projects.findOne({ where: { id: saved.projectId } });
      const businessProfile = project
        ? await tx.businessProfiles.findOne({ where: { id: project.businessId } })
        : null;

      return {
        task: saved,
        previousStatus,
        consultantUserId,
        businessUserId: businessProfile?.userId ?? null,
        payoutAmount,
      };
    });

    if (result.consultantUserId && result.businessUserId) {
      this.emitStatusChangedEvent({
        task: result.task,
        oldStatus: result.previousStatus,
        newStatus: TaskKanbanStatus.DONE,
        consultantUserId: result.consultantUserId,
        businessUserId: result.businessUserId,
        earnedAmount: result.payoutAmount,
      });
    }

    this.logger.log(
      `[${this.rid}] markDone — complete | taskId: ${taskId}, payout: ${result.payoutAmount}`,
    );
  }

  /** @inheritdoc */
  public async markRevisionRequested(taskId: string, feedbackSummary: string): Promise<void> {
    this.logger.log(`[${this.rid}] markRevisionRequested — start | taskId: ${taskId}`);

    const result = await this.uow.withTransaction(async (tx) => {
      const locked = await tx.tasks.lockTaskForReview(taskId, [
        TaskKanbanStatus.IN_REVIEW,
        TaskKanbanStatus.PENDING_APPROVAL,
      ]);
      if (!locked) {
        this.logger.warn(
          `[${this.rid}] markRevisionRequested — task not found or wrong status | taskId: ${taskId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task.not_found',
          errorCode: ERROR_CODES.TASK_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      const newRevisionCount = await tx.tasks.incrementRevisionCount(taskId);
      const previousStatus = locked.kanbanStatus;

      // Hard-stop at the cap — convert into a dispute for admin adjudication.
      if (newRevisionCount > REVISION_CAP) {
        const consultantId = locked.assignedTo;
        if (consultantId) {
          // Need a user id for `opened_by`; fall back to assignee user id.
          const consultantProfile = await tx.consultantProfiles.findOne({
            where: { id: consultantId },
          });
          if (consultantProfile) {
            await tx.taskDisputes.save(
              tx.taskDisputes.create({
                taskId: locked.id,
                openedBy: consultantProfile.userId,
                reason: `3+1 review cap reached. Last feedback: ${feedbackSummary}`,
                status: TaskDisputeStatus.OPEN,
                openedAt: new Date(),
              }),
            );
          }
        }
        locked.kanbanStatus = TaskKanbanStatus.PENDING_APPROVAL;
        locked.completedAt = null;
        await tx.tasks.save(locked);
        return {
          task: locked,
          previousStatus,
          newStatus: TaskKanbanStatus.PENDING_APPROVAL,
          revisionCount: newRevisionCount,
          revisionsRemaining: 0,
          escalated: true,
        };
      }

      locked.kanbanStatus = TaskKanbanStatus.REVISION_REQUESTED;
      locked.completedAt = null;
      await tx.tasks.save(locked);

      return {
        task: locked,
        previousStatus,
        newStatus: TaskKanbanStatus.REVISION_REQUESTED,
        revisionCount: newRevisionCount,
        revisionsRemaining: Math.max(0, REVISION_CAP - newRevisionCount),
        escalated: false,
      };
    });

    // Emit AFTER commit. Need consultant + business user ids again.
    const consultantProfile = result.task.assignedTo
      ? await this.uow.consultantProfiles.findOne({ where: { id: result.task.assignedTo } })
      : null;
    const project = await this.uow.projects.findOne({ where: { id: result.task.projectId } });
    const businessProfile = project
      ? await this.uow.businessProfiles.findOne({ where: { id: project.businessId } })
      : null;

    if (consultantProfile && businessProfile) {
      this.emitStatusChangedEvent({
        task: result.task,
        oldStatus: result.previousStatus,
        newStatus: result.newStatus,
        consultantUserId: consultantProfile.userId,
        businessUserId: businessProfile.userId,
        feedbackSummary,
        revisionCount: result.revisionCount,
        revisionsRemaining: result.revisionsRemaining,
      });
    }

    this.logger.log(
      `[${this.rid}] markRevisionRequested — complete | taskId: ${taskId}, revision_count: ${result.revisionCount}, escalated: ${result.escalated}`,
    );
  }

  private emitStatusChangedEvent(params: {
    task: Task;
    oldStatus: TaskKanbanStatus;
    newStatus: TaskKanbanStatus;
    consultantUserId: string;
    businessUserId: string;
    earnedAmount?: string;
    feedbackSummary?: string;
    revisionCount?: number;
    revisionsRemaining?: number;
  }): void {
    const payload: ITaskStatusChangedEvent = {
      task_id: params.task.id,
      task_code: params.task.code,
      task_title: params.task.title,
      project_id: params.task.projectId,
      old_status: params.oldStatus,
      new_status: params.newStatus,
      consultant_user_id: params.consultantUserId,
      business_user_id: params.businessUserId,
      earned_amount: params.earnedAmount,
      feedback_summary: params.feedbackSummary,
      revision_count: params.revisionCount,
      revisions_remaining: params.revisionsRemaining,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.TASK_STATUS_CHANGED, payload);
  }

  // `consultant_payout` is a STORED generated column; TypeORM returns numeric
  // columns as strings already, but normalise defensively so downstream code
  // can rely on a canonical 2-decimal representation.
  private normalisePayout(raw: number | string): string {
    const numeric = typeof raw === 'string' ? Number(raw) : raw;
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`markDone: task consultant_payout is invalid (${String(raw)})`);
    }
    return numeric.toFixed(2);
  }
}
