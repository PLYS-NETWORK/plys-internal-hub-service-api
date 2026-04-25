import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Task } from '@database/entities';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Not } from 'typeorm';

import { TASK_ERRORS } from '../shared/constants/task-error-messages.constant';
import { CONSULTANT_TRANSITIONS } from '../shared/constants/task-transitions.constant';
import { ITaskStatusTransitionStrategy } from '../shared/interfaces/task-status-transition.strategy.interface';
import { TaskAccessService } from '../shared/services/task-access.service';

/**
 * Consultant-side status transitions.
 *
 * Validation: every (current, target) pair must be present in `CONSULTANT_TRANSITIONS`.
 *
 * Special branches:
 * - `TO_DO → IN_PROGRESS`: project-membership check, one-task-in-progress check,
 *   pessimistic write lock to race-safely auto-assign + start.
 * - `IN_PROGRESS → TO_DO`: caller must currently be the assignee; clears assignment.
 * - Any `* → IN_PROGRESS`: enforce one-task-in-progress.
 * - Other transitions: caller must be the assignee; simple status flip + save.
 */
@Injectable()
export class ConsultantTaskStatusStrategy implements ITaskStatusTransitionStrategy {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly taskAccess: TaskAccessService,
  ) {
    this.logger = new AppLogger(ConsultantTaskStatusStrategy.name, requestContext);
  }

  /** @inheritdoc */
  public async transition(task: Task, target: TaskKanbanStatus): Promise<Task> {
    const consultantProfile = await this.taskAccess.resolveConsultantProfile();

    const allowed = CONSULTANT_TRANSITIONS.get(task.kanbanStatus);
    if (!allowed || !allowed.includes(target)) {
      this.logger.warn(
        `transition — invalid | taskId: ${task.id}, from: ${task.kanbanStatus}, to: ${target}`,
      );
      throw new TranslatableException({
        messageKey: TASK_ERRORS.INVALID_STATUS_TRANSITION,
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // ── to_do → in_progress: race-safe auto-assign + start ──
    if (task.kanbanStatus === TaskKanbanStatus.TO_DO && target === TaskKanbanStatus.IN_PROGRESS) {
      return this.selfAssignAndStart(task, consultantProfile.id);
    }

    // All remaining transitions require the caller to be the assignee
    if (task.assignedTo !== consultantProfile.id) {
      this.logger.warn(
        `transition — not assigned | taskId: ${task.id}, assignedTo: ${task.assignedTo}, consultantId: ${consultantProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: TASK_ERRORS.INVALID_STATUS_TRANSITION,
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.FORBIDDEN,
      });
    }

    // ── in_progress → to_do: auto-unassign ──
    if (task.kanbanStatus === TaskKanbanStatus.IN_PROGRESS && target === TaskKanbanStatus.TO_DO) {
      return this.unassign(task);
    }

    // ── any other → in_progress: enforce one-task-in-progress ──
    if (target === TaskKanbanStatus.IN_PROGRESS) {
      await this.checkNoOtherInProgressTask(consultantProfile.id, task.id);
    }

    task.kanbanStatus = target;
    return this.uow.tasks.save(task);
  }

  /**
   * Acquires a pessimistic write lock on the unassigned `to_do` task and
   * atomically assigns + transitions to `in_progress`. Verifies project
   * membership and one-task-in-progress constraint before locking.
   */
  private async selfAssignAndStart(task: Task, consultantId: string): Promise<Task> {
    await this.taskAccess.verifyProjectMembership(task.projectId, consultantId);
    await this.checkNoOtherInProgressTask(consultantId, task.id);

    return this.uow.withTransaction(async (txUow) => {
      const locked = await txUow.tasks
        .createQueryBuilder('task')
        .setLock('pessimistic_write_or_fail')
        .where('task.id = :taskId', { taskId: task.id })
        .andWhere('task.kanban_status = :status', { status: TaskKanbanStatus.TO_DO })
        .andWhere('task.assigned_to IS NULL')
        .getOne();

      if (!locked) {
        throw new TranslatableException({
          messageKey: TASK_ERRORS.ALREADY_ASSIGNED,
          errorCode: ERROR_CODES.TASK_ALREADY_ASSIGNED,
          status: HttpStatus.CONFLICT,
        });
      }

      locked.assignedTo = consultantId;
      locked.assignedAt = new Date();
      locked.kanbanStatus = TaskKanbanStatus.IN_PROGRESS;
      return txUow.tasks.save(locked);
    });
  }

  /** Clears assignment fields and resets status to TO_DO. */
  private async unassign(task: Task): Promise<Task> {
    task.assignedTo = null;
    task.assignedAt = null;
    task.kanbanStatus = TaskKanbanStatus.TO_DO;
    return this.uow.tasks.save(task);
  }

  /**
   * Throws CONFLICT if the consultant has any other task in `in_progress`.
   */
  private async checkNoOtherInProgressTask(
    consultantId: string,
    excludeTaskId: string,
  ): Promise<void> {
    const count = await this.uow.tasks.count({
      where: {
        assignedTo: consultantId,
        kanbanStatus: TaskKanbanStatus.IN_PROGRESS,
        id: Not(excludeTaskId),
      },
    });

    if (count > 0) {
      this.logger.warn(`transition — already in progress | consultantId: ${consultantId}`);
      throw new TranslatableException({
        messageKey: TASK_ERRORS.CONSULTANT_ALREADY_IN_PROGRESS,
        errorCode: ERROR_CODES.TASK_CONSULTANT_ALREADY_IN_PROGRESS,
        status: HttpStatus.CONFLICT,
      });
    }
  }
}
