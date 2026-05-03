import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { TaskDifficulty, TaskKanbanStatus } from '@database/enums';
import { ProjectStatusService } from '@modules/business-projects/services/projects/project-status.service';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ChangeTaskStatusDto } from '../../dto/requests';
import { ConsultantBoardTaskResponseDto } from '../../dto/responses';
import { IConsultantBoardService } from '../../interfaces/consultant-board.service.interface';
import { ConsultantAccessService } from '../consultant-access.service';

// Statuses surfaced on the consultant kanban (everything except DRAFT, which
// the business backlog owns).
const NON_DRAFT_STATUSES: TaskKanbanStatus[] = [
  TaskKanbanStatus.TO_DO,
  TaskKanbanStatus.ASSIGNED,
  TaskKanbanStatus.IN_PROGRESS,
  TaskKanbanStatus.IN_REVIEW,
  TaskKanbanStatus.PENDING_APPROVAL,
  TaskKanbanStatus.REVISION_REQUESTED,
  TaskKanbanStatus.DONE,
  TaskKanbanStatus.CANCELLED,
];

// Allowed transitions for a consultant. DONE/CANCELLED are business-only;
// any move to/from those statuses is rejected here to keep parity with the
// product contract documented in the plan §4.4.
const CONSULTANT_TRANSITIONS: ReadonlyMap<
  TaskKanbanStatus,
  ReadonlySet<TaskKanbanStatus>
> = new Map<TaskKanbanStatus, ReadonlySet<TaskKanbanStatus>>([
  [TaskKanbanStatus.ASSIGNED, new Set<TaskKanbanStatus>([TaskKanbanStatus.IN_PROGRESS])],
  [TaskKanbanStatus.IN_PROGRESS, new Set<TaskKanbanStatus>([TaskKanbanStatus.IN_REVIEW])],
  [TaskKanbanStatus.IN_REVIEW, new Set<TaskKanbanStatus>([TaskKanbanStatus.IN_PROGRESS])],
]);

interface IBoardTaskRow {
  task_id: string;
  task_code: string;
  task_title: string;
  task_difficulty: TaskDifficulty;
  task_kanban_status: TaskKanbanStatus;
  task_display_order: number;
  consultant_id: string | null;
  consultant_full_name: string | null;
  consultant_avatar_url: string | null;
  comment_count: number;
  evidences_count: number;
}

@Injectable()
export class ConsultantBoardService implements IConsultantBoardService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: ConsultantAccessService,
    private readonly projectStatus: ProjectStatusService,
  ) {
    this.logger = new AppLogger(ConsultantBoardService.name, requestContext);
  }

  /** @inheritdoc */
  public async listTasks(projectId: string): Promise<ConsultantBoardTaskResponseDto[]> {
    this.logger.log(`listTasks — start | projectId: ${projectId}`);
    await this.access.resolveProjectMembership(projectId);

    const rows = await this.uow.tasks
      .createQueryBuilder('t')
      .leftJoin('t.assignee', 'cp')
      .select('t.id', 'task_id')
      .addSelect('t.code', 'task_code')
      .addSelect('t.title', 'task_title')
      .addSelect('t.difficulty_level', 'task_difficulty')
      .addSelect('t.kanban_status', 'task_kanban_status')
      .addSelect('t.display_order', 'task_display_order')
      .addSelect('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'consultant_full_name')
      .addSelect('cp.avatar_url', 'consultant_avatar_url')
      .addSelect(
        '(SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id AND tc.is_deleted = false)',
        'comment_count',
      )
      .addSelect(
        '(SELECT COUNT(*)::int FROM task_evidences te WHERE te.task_id = t.id AND te.is_deleted = false)',
        'evidences_count',
      )
      .where('t.project_id = :projectId', { projectId })
      .andWhere('t.kanban_status IN (:...nonDraft)', { nonDraft: NON_DRAFT_STATUSES })
      .andWhere('t.deleted_at IS NULL')
      .orderBy('t.display_order', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .getRawMany<IBoardTaskRow>();

    const data = rows.map((r) =>
      plainToInstance(
        ConsultantBoardTaskResponseDto,
        {
          id: r.task_id,
          code: r.task_code,
          title: r.task_title,
          kanban_status: r.task_kanban_status,
          display_order: Number(r.task_display_order),
          difficulty_level: r.task_difficulty,
          assignee: r.consultant_id
            ? {
                consultant_id: r.consultant_id,
                full_name: r.consultant_full_name ?? '',
                avatar_url: r.consultant_avatar_url,
              }
            : null,
          comment_count: Number(r.comment_count ?? 0),
          evidences_count: Number(r.evidences_count ?? 0),
        },
        { excludeExtraneousValues: true },
      ),
    );

    this.logger.log(`listTasks — complete | projectId: ${projectId}, count: ${data.length}`);
    return data;
  }

  /** @inheritdoc */
  public async assignSelf(projectId: string, taskId: string): Promise<void> {
    this.logger.log(`assignSelf — start | projectId: ${projectId}, taskId: ${taskId}`);
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    const consultantId = consultantProfile.id;

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      // Lock the row first so the assignee/state checks below see the same
      // committed view as the UPDATE that follows. Two concurrent self-assign
      // calls serialise here: the second waits for the first to commit, then
      // re-reads the row (now `assigned_to !== null`) and raises
      // TASK_ALREADY_ASSIGNED instead of overwriting the winner.
      const task = await tx.tasks
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :taskId', { taskId })
        .andWhere('t.project_id = :projectId', { projectId })
        .andWhere('t.deleted_at IS NULL')
        .getOne();

      if (!task) {
        this.logger.warn(`assignSelf — task not found | taskId: ${taskId}`);
        throw new TranslatableException({
          messageKey: 'error.task.not_found',
          errorCode: ERROR_CODES.TASK_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Explicit assignee check produces a precise 409 instead of a generic
      // 422 — surfaces the "someone else got there first" case clearly to the
      // FE so it can refresh the board and toast the user.
      if (task.assignedTo !== null) {
        this.logger.warn(
          `assignSelf — already assigned | taskId: ${taskId}, assignedTo: ${task.assignedTo}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task.already_assigned',
          errorCode: ERROR_CODES.TASK_ALREADY_ASSIGNED,
          status: HttpStatus.CONFLICT,
        });
      }

      if (task.kanbanStatus !== TaskKanbanStatus.TO_DO) {
        this.logger.warn(
          `assignSelf — not claimable | taskId: ${taskId}, status: ${task.kanbanStatus}`,
        );
        throw this.invalidStatusTransition();
      }

      task.assignedTo = consultantId;
      task.assignedAt = DateUtil.nowDate();
      task.kanbanStatus = TaskKanbanStatus.ASSIGNED;
      await tx.tasks.save(task);
      await this.projectStatus.promoteToInProgressIfPublished(tx, projectId);
    });

    this.logger.log(`assignSelf — complete | taskId: ${taskId}`);
  }

  /** @inheritdoc */
  public async unassignSelf(projectId: string, taskId: string): Promise<void> {
    this.logger.log(`unassignSelf — start | projectId: ${projectId}, taskId: ${taskId}`);
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    const consultantId = consultantProfile.id;

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      const task = await tx.tasks
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :taskId', { taskId })
        .andWhere('t.project_id = :projectId', { projectId })
        .andWhere('t.deleted_at IS NULL')
        .getOne();

      if (!task) {
        throw new TranslatableException({
          messageKey: 'error.task.not_found',
          errorCode: ERROR_CODES.TASK_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (task.assignedTo !== consultantId || task.kanbanStatus !== TaskKanbanStatus.ASSIGNED) {
        this.logger.warn(
          `unassignSelf — not eligible | taskId: ${taskId}, status: ${task.kanbanStatus}, assignedTo: ${task.assignedTo}`,
        );
        throw this.invalidStatusTransition();
      }

      task.assignedTo = null;
      task.assignedAt = null;
      task.kanbanStatus = TaskKanbanStatus.TO_DO;
      await tx.tasks.save(task);
    });

    this.logger.log(`unassignSelf — complete | taskId: ${taskId}`);
  }

  /** @inheritdoc */
  public async changeStatus(
    projectId: string,
    taskId: string,
    dto: ChangeTaskStatusDto,
  ): Promise<void> {
    this.logger.log(
      `changeStatus — start | projectId: ${projectId}, taskId: ${taskId}, target: ${dto.kanbanStatus}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    const consultantId = consultantProfile.id;

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      const task = await tx.tasks
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :taskId', { taskId })
        .andWhere('t.project_id = :projectId', { projectId })
        .andWhere('t.deleted_at IS NULL')
        .getOne();

      if (!task) {
        throw new TranslatableException({
          messageKey: 'error.task.not_found',
          errorCode: ERROR_CODES.TASK_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (task.assignedTo !== consultantId) {
        this.logger.warn(
          `changeStatus — not assignee | taskId: ${taskId}, assignedTo: ${task.assignedTo}`,
        );
        throw this.invalidStatusTransition();
      }

      const allowed = CONSULTANT_TRANSITIONS.get(task.kanbanStatus);
      if (!allowed || !allowed.has(dto.kanbanStatus)) {
        this.logger.warn(
          `changeStatus — not allowed | taskId: ${taskId}, from: ${task.kanbanStatus}, to: ${dto.kanbanStatus}`,
        );
        throw this.invalidStatusTransition();
      }

      // Enforce 1 IN_PROGRESS task per consultant. The `excludeTaskId` argument
      // matters when the consultant flips IN_REVIEW → IN_PROGRESS for their
      // current task — that row's previous IN_PROGRESS state is no longer
      // present after the status change above completes, so excluding it
      // protects against false positives if the query is repeated.
      if (dto.kanbanStatus === TaskKanbanStatus.IN_PROGRESS) {
        const blocked = await tx.tasks.existsInProgressByAssignee(consultantId, taskId);
        if (blocked) {
          this.logger.warn(`changeStatus — already in progress | consultantId: ${consultantId}`);
          throw new TranslatableException({
            messageKey: 'error.task.consultant_already_in_progress',
            errorCode: ERROR_CODES.TASK_CONSULTANT_ALREADY_IN_PROGRESS,
            status: HttpStatus.CONFLICT,
          });
        }
      }

      task.kanbanStatus = dto.kanbanStatus;
      await tx.tasks.save(task);
    });

    this.logger.log(`changeStatus — complete | taskId: ${taskId}`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private invalidStatusTransition(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.task.invalid_status_transition',
      errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
