import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { Task } from '@database/entities';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { TASK_ERRORS } from '../shared/constants/task-error-messages.constant';
import { BUSINESS_FORBIDDEN_TARGETS } from '../shared/constants/task-transitions.constant';
import { ITaskStatusTransitionStrategy } from '../shared/interfaces/task-status-transition.strategy.interface';
import { TaskAccessService } from '../shared/services/task-access.service';
import { TaskPaymentService } from '../shared/services/task-payment.service';

/**
 * Business-side status transitions.
 *
 * Behaviour:
 * - Reject `target = DRAFT` (business may never demote a task to draft).
 * - `DRAFT → TO_DO`: hand off to `TaskPaymentService.chargeForActivation` (payment gate).
 * - `* → DONE`: hand off to `TaskPaymentService.payoutForCompletion`.
 * - All other transitions: simple status flip + save.
 */
@Injectable()
export class BusinessTaskStatusStrategy implements ITaskStatusTransitionStrategy {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly taskAccess: TaskAccessService,
    private readonly taskPayment: TaskPaymentService,
  ) {}

  /** @inheritdoc */
  public async transition(task: Task, target: TaskKanbanStatus): Promise<Task> {
    if (BUSINESS_FORBIDDEN_TARGETS.has(target)) {
      throw new TranslatableException({
        messageKey: TASK_ERRORS.INVALID_STATUS_TRANSITION,
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    const businessProfile = await this.taskAccess.resolveBusinessProfile();

    if (task.kanbanStatus === TaskKanbanStatus.DRAFT && target === TaskKanbanStatus.TO_DO) {
      return this.taskPayment.chargeForActivation(task, businessProfile);
    }

    if (target === TaskKanbanStatus.DONE) {
      return this.taskPayment.payoutForCompletion(task, businessProfile);
    }

    task.kanbanStatus = target;
    return this.uow.tasks.save(task);
  }
}
