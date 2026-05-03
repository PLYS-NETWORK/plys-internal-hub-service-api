import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Task } from '@database/entities';
import { ProjectMemberStatus, TaskKanbanStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  AssignTaskDto,
  ChangeTaskStatusesDto,
  ReorderTasksDto,
  TaskOrderItemDto,
  TaskStatusItemDto,
} from '../../dto/requests';
import { BoardTaskDetailResponseDto, BoardTaskResponseDto } from '../../dto/responses';
import { IBoardService } from '../../interfaces/board.service.interface';
import { BusinessAccessService } from '../business-access.service';
import { ProjectStatusService } from '../projects/project-status.service';

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

// DRAFT/DONE/CANCELLED are owned by other flows: DRAFT by `createDraftTask`,
// DONE by approval, CANCELLED by project cancellation. Reorder/move never
// crosses these boundaries — the business cannot drag-and-drop a task back
// from terminal state, and cannot manually push a task into one.
const TERMINAL_OR_DRAFT: ReadonlySet<TaskKanbanStatus> = new Set([
  TaskKanbanStatus.DRAFT,
  TaskKanbanStatus.DONE,
  TaskKanbanStatus.CANCELLED,
]);

// Bulk SQL UPDATE batch size. A 200-task payload becomes 4 statements; locks
// accumulate on the same xact so concurrency is unchanged. Smaller batches
// keep individual statements cheap to parse and easy to retry.
const BATCH_SIZE = 50;

interface IBoardTaskRow {
  task_id: string;
  task_code: string;
  task_title: string;
  task_price: string;
  task_difficulty: string;
  task_kanban_status: TaskKanbanStatus;
  task_display_order: number;
  consultant_id: string | null;
  consultant_full_name: string | null;
  consultant_avatar_url: string | null;
  comments_count: number;
  evidences_count: number;
}

@Injectable()
export class BoardService implements IBoardService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly projectStatus: ProjectStatusService,
  ) {
    this.logger = new AppLogger(BoardService.name, requestContext);
  }

  /** @inheritdoc */
  public async listTasks(projectId: string): Promise<BoardTaskResponseDto[]> {
    this.logger.log(`listTasks — start | projectId: ${projectId}`);
    await this.access.resolveOwnedProject(projectId);

    const rows = await this.uow.tasks
      .createQueryBuilder('t')
      .leftJoin('t.assignee', 'cp')
      .select('t.id', 'task_id')
      .addSelect('t.code', 'task_code')
      .addSelect('t.title', 'task_title')
      .addSelect('t.price', 'task_price')
      .addSelect('t.difficulty_level', 'task_difficulty')
      .addSelect('t.kanban_status', 'task_kanban_status')
      .addSelect('t.display_order', 'task_display_order')
      .addSelect('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'consultant_full_name')
      .addSelect('cp.avatar_url', 'consultant_avatar_url')
      .addSelect(
        '(SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id AND tc.is_deleted = false)',
        'comments_count',
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
        BoardTaskResponseDto,
        {
          id: r.task_id,
          code: r.task_code,
          title: r.task_title,
          price: Number(r.task_price).toFixed(2),
          difficulty_level: r.task_difficulty,
          kanban_status: r.task_kanban_status,
          display_order: Number(r.task_display_order),
          assignee: r.consultant_id
            ? {
                consultant_id: r.consultant_id,
                full_name: r.consultant_full_name ?? '',
                avatar_url: r.consultant_avatar_url,
              }
            : null,
          comments_count: Number(r.comments_count ?? 0),
          evidences_count: Number(r.evidences_count ?? 0),
        },
        { excludeExtraneousValues: true },
      ),
    );

    this.logger.log(`listTasks — complete | projectId: ${projectId}, count: ${data.length}`);
    return data;
  }

  /** @inheritdoc */
  public async reorderTasks(projectId: string, dto: ReorderTasksDto): Promise<void> {
    this.logger.log(
      `reorderTasks — start | projectId: ${projectId}, status: ${dto.currentStatus}, count: ${dto.tasks.length}`,
    );
    await this.access.resolveOwnedProject(projectId);

    if (TERMINAL_OR_DRAFT.has(dto.currentStatus)) {
      this.invalidStatusTransition('reorderTasks', `currentStatus=${dto.currentStatus}`);
    }

    // Reject duplicate (display_order) values within the payload — the new
    // partial unique index on (project_id, kanban_status, display_order)
    // would surface this as a constraint error inside the transaction, but
    // catching it up-front gives a cleaner 422 and avoids the retry.
    const orderSet = new Set<number>();
    for (const t of dto.tasks) {
      if (orderSet.has(t.displayOrder)) {
        this.invalidStatusTransition('reorderTasks', `duplicate display_order=${t.displayOrder}`);
      }
      orderSet.add(t.displayOrder);
    }

    await this.uow.withTransaction(async (tx) => {
      await this.lockProjectRow(tx, projectId);

      const ids = dto.tasks.map((t) => t.id);
      const existing = await tx.tasks
        .createQueryBuilder('t')
        .where('t.id IN (:...ids)', { ids })
        .andWhere('t.project_id = :projectId', { projectId })
        .andWhere('t.deleted_at IS NULL')
        .setLock('pessimistic_write')
        .getMany();

      if (existing.length !== ids.length) {
        this.invalidStatusTransition(
          'reorderTasks',
          `count mismatch: requested=${ids.length}, found=${existing.length}`,
        );
      }
      for (const task of existing) {
        if (task.kanbanStatus !== dto.currentStatus) {
          this.invalidStatusTransition(
            'reorderTasks',
            `id=${task.id} status=${task.kanbanStatus} expected=${dto.currentStatus}`,
          );
        }
      }

      // Single SQL per batch — TypeORM's save(array) would issue one UPDATE
      // per row because @VersionColumn is per-row, so 200 tasks → 200 round
      // trips. Manual VALUES join collapses each batch into a single statement
      // and bumps `version` ourselves so the row's optimistic-lock invariant
      // is preserved.
      for (const batch of chunk(dto.tasks, BATCH_SIZE)) {
        await this.applyReorderBatch(tx, projectId, batch);
      }
    });

    this.logger.log(
      `reorderTasks — complete | projectId: ${projectId}, updated: ${dto.tasks.length}`,
    );
  }

  /** @inheritdoc */
  public async changeTaskStatuses(projectId: string, dto: ChangeTaskStatusesDto): Promise<void> {
    this.logger.log(
      `changeTaskStatuses — start | projectId: ${projectId}, count: ${dto.tasks.length}`,
    );
    await this.access.resolveOwnedProject(projectId);

    for (const t of dto.tasks) {
      if (TERMINAL_OR_DRAFT.has(t.kanbanStatus)) {
        this.invalidStatusTransition('changeTaskStatuses', `id=${t.id} target=${t.kanbanStatus}`);
      }
    }

    await this.uow.withTransaction(async (tx) => {
      await this.lockProjectRow(tx, projectId);

      const ids = dto.tasks.map((t) => t.id);
      const existing = await tx.tasks
        .createQueryBuilder('t')
        .where('t.id IN (:...ids)', { ids })
        .andWhere('t.project_id = :projectId', { projectId })
        .andWhere('t.deleted_at IS NULL')
        .setLock('pessimistic_write')
        .getMany();

      if (existing.length !== ids.length) {
        this.invalidStatusTransition(
          'changeTaskStatuses',
          `count mismatch: requested=${ids.length}, found=${existing.length}`,
        );
      }

      const targetById = new Map(dto.tasks.map((t) => [t.id, t.kanbanStatus]));
      for (const task of existing) {
        if (TERMINAL_OR_DRAFT.has(task.kanbanStatus)) {
          this.invalidStatusTransition(
            'changeTaskStatuses',
            `id=${task.id} source=${task.kanbanStatus}`,
          );
        }
        if (task.kanbanStatus === targetById.get(task.id)) {
          // No-op moves complicate end-of-column placement (we'd have to
          // distinguish "stay in place" from "move to tail of same column")
          // and there's no UI affordance that produces them. Reject so the
          // contract stays unambiguous.
          this.invalidStatusTransition(
            'changeTaskStatuses',
            `taskId=${task.id} already in ${task.kanbanStatus}`,
          );
        }
      }

      // Each batch's `maxes` CTE re-reads MAX(display_order) per status, so
      // batch N+1 sees batch N's writes within the same transaction (Postgres
      // MVCC: prior statement effects are visible to later statements in the
      // same xact). 200 tasks → 4 statements, no order collisions across
      // batches even when several batches target the same destination column.
      for (const batch of chunk(dto.tasks, BATCH_SIZE)) {
        await this.applyStatusBatch(tx, projectId, batch);
      }
    });

    this.logger.log(
      `changeTaskStatuses — complete | projectId: ${projectId}, moved: ${dto.tasks.length}`,
    );
  }

  /** @inheritdoc */
  public async getTaskDetail(
    projectId: string,
    taskId: string,
  ): Promise<BoardTaskDetailResponseDto> {
    this.logger.log(`getTaskDetail — start | projectId: ${projectId}, taskId: ${taskId}`);
    await this.access.resolveOwnedProject(projectId);

    const task = await this.uow.tasks.findOne({
      where: { id: taskId, projectId },
      relations: { assignee: true },
    });
    if (!task || task.kanbanStatus === TaskKanbanStatus.DRAFT) {
      this.logger.warn(`getTaskDetail — not found or draft | taskId: ${taskId}`);
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [commentsCount, evidencesCount] = await Promise.all([
      this.uow.taskComments
        .createQueryBuilder('tc')
        .where('tc.task_id = :taskId', { taskId })
        .andWhere('tc.is_deleted = false')
        .getCount(),
      this.uow.taskEvidences
        .createQueryBuilder('te')
        .where('te.task_id = :taskId', { taskId })
        .andWhere('te.is_deleted = false')
        .getCount(),
    ]);

    this.logger.log(`getTaskDetail — complete | taskId: ${taskId}`);
    return plainToInstance(
      BoardTaskDetailResponseDto,
      {
        id: task.id,
        code: task.code,
        title: task.title,
        description: task.description,
        price: Number(task.price).toFixed(2),
        platform_fee_amount: Number(task.platformFeeAmount).toFixed(2),
        consultant_payout: Number(task.consultantPayout).toFixed(2),
        difficulty_level: task.difficultyLevel,
        kanban_status: task.kanbanStatus,
        display_order: task.displayOrder,
        assignee: task.assignee
          ? {
              consultant_id: task.assignee.id,
              full_name: task.assignee.fullName,
              avatar_url: task.assignee.avatarUrl ?? null,
            }
          : null,
        comments_count: commentsCount,
        evidences_count: evidencesCount,
        approved_by: task.approvedBy,
        approved_at: task.approvedAt,
        due_date: task.dueDate,
        version: task.version,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async assign(projectId: string, taskId: string, dto: AssignTaskDto): Promise<void> {
    this.logger.log(
      `assign — start | projectId: ${projectId}, taskId: ${taskId}, consultantId: ${dto.consultantId}`,
    );
    await this.access.resolveOwnedProject(projectId);

    await this.uow.withTransaction(async (tx) => {
      const task = await this.loadAssignableTask(tx, projectId, taskId);

      const member = await tx.projectMembers.findOne({
        where: {
          projectId,
          consultantId: dto.consultantId,
          status: ProjectMemberStatus.ACTIVE,
        },
      });
      if (!member) {
        throw new TranslatableException({
          messageKey: 'error.task.consultant_not_project_member',
          errorCode: ERROR_CODES.TASK_CONSULTANT_NOT_PROJECT_MEMBER,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }

      task.assignedTo = dto.consultantId;
      task.assignedAt = DateUtil.nowDate();
      if (task.kanbanStatus === TaskKanbanStatus.TO_DO) {
        task.kanbanStatus = TaskKanbanStatus.ASSIGNED;
      }
      await tx.tasks.save(task);
      await this.projectStatus.promoteToInProgressIfPublished(tx, projectId);
    });

    this.logger.log(`assign — complete | taskId: ${taskId}`);
  }

  /** @inheritdoc */
  public async unassign(projectId: string, taskId: string): Promise<void> {
    this.logger.log(`unassign — start | projectId: ${projectId}, taskId: ${taskId}`);
    await this.access.resolveOwnedProject(projectId);

    await this.uow.withTransaction(async (tx) => {
      const task = await this.loadAssignableTask(tx, projectId, taskId);

      // Only safe to unassign while still in early stages — silently dropping
      // a consultant past IN_PROGRESS would lose work.
      if (
        task.kanbanStatus !== TaskKanbanStatus.ASSIGNED &&
        task.kanbanStatus !== TaskKanbanStatus.TO_DO
      ) {
        throw new TranslatableException({
          messageKey: 'error.task.invalid_status_transition',
          errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }

      task.assignedTo = null;
      task.assignedAt = null;
      if (task.kanbanStatus === TaskKanbanStatus.ASSIGNED) {
        task.kanbanStatus = TaskKanbanStatus.TO_DO;
      }
      await tx.tasks.save(task);
    });

    this.logger.log(`unassign — complete | taskId: ${taskId}`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async lockProjectRow(tx: IUnitOfWork, projectId: string): Promise<void> {
    // Serializes all board write paths on the same project (mirrors the
    // pattern in BacklogsService.payTasks which locks the business profile).
    // Without this, two concurrent reorder/status calls would each take
    // pessimistic_write on overlapping task subsets and we'd have to rely on
    // OptimisticLockVersionMismatchError to surface conflicts.
    await tx.projects
      .createQueryBuilder('p')
      .where('p.id = :projectId', { projectId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async applyReorderBatch(
    tx: IUnitOfWork,
    projectId: string,
    batch: TaskOrderItemDto[],
  ): Promise<void> {
    const params: unknown[] = [];
    const values = batch
      .map((t) => {
        params.push(t.id, t.displayOrder);
        const base = params.length;
        return `($${base - 1}::uuid, $${base}::int)`;
      })
      .join(', ');

    params.push(projectId);
    const projectIdx = params.length;

    await tx.tasks.query(
      `
      UPDATE tasks AS t
         SET display_order = v.display_order,
             version       = t.version + 1,
             updated_at    = NOW()
        FROM (VALUES ${values}) AS v(id, display_order)
       WHERE t.id = v.id
         AND t.project_id = $${projectIdx}
         AND t.deleted_at IS NULL
      `,
      params,
    );
  }

  private async applyStatusBatch(
    tx: IUnitOfWork,
    projectId: string,
    batch: TaskStatusItemDto[],
  ): Promise<void> {
    const params: unknown[] = [];
    const valueRows = batch
      .map((t, idx) => {
        params.push(t.id, t.kanbanStatus, idx + 1);
        const base = params.length;
        return `($${base - 2}::uuid, $${base - 1}::varchar, $${base}::int)`;
      })
      .join(', ');

    params.push(projectId);
    const projectIdx = params.length;

    // The CTE pattern: `targets` ranks the payload per destination status,
    // `maxes` reads the current tail per status (visible: prior batches' writes
    // in this xact), and the UPDATE places each task at `max + rn`.
    await tx.tasks.query(
      `
      WITH targets AS (
        SELECT v.task_id::uuid       AS id,
               v.kanban_status::varchar AS target_status,
               ROW_NUMBER() OVER (
                 PARTITION BY v.kanban_status ORDER BY v.idx
               ) AS rn
          FROM (VALUES ${valueRows}) AS v(task_id, kanban_status, idx)
      ),
      maxes AS (
        SELECT kanban_status, COALESCE(MAX(display_order), 0) AS max_order
          FROM tasks
         WHERE project_id = $${projectIdx}
           AND deleted_at IS NULL
         GROUP BY kanban_status
      )
      UPDATE tasks AS t
         SET kanban_status = targets.target_status,
             display_order = COALESCE(maxes.max_order, 0) + targets.rn,
             version       = t.version + 1,
             updated_at    = NOW()
        FROM targets
        LEFT JOIN maxes ON maxes.kanban_status = targets.target_status
       WHERE t.id = targets.id
         AND t.project_id = $${projectIdx}
         AND t.deleted_at IS NULL
      `,
      params,
    );
  }

  private invalidStatusTransition(method: string, detail: string): never {
    this.logger.warn(`${method} — invalid transition | ${detail}`);
    throw new TranslatableException({
      messageKey: 'error.task.invalid_status_transition',
      errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }

  private async loadAssignableTask(
    tx: IUnitOfWork,
    projectId: string,
    taskId: string,
  ): Promise<Task> {
    const task = await tx.tasks.findOne({ where: { id: taskId, projectId } });
    if (!task) {
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    if (
      task.kanbanStatus === TaskKanbanStatus.DRAFT ||
      task.kanbanStatus === TaskKanbanStatus.CANCELLED ||
      task.kanbanStatus === TaskKanbanStatus.DONE
    ) {
      throw new TranslatableException({
        messageKey: 'error.task.invalid_status_transition',
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
    return task;
  }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
