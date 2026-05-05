import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskCreationMode, TaskKanbanStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ReorderTasksDto, TaskOrderItemDto } from '../../dto/requests';
import { BoardTaskDetailResponseDto, BoardTaskResponseDto } from '../../dto/responses';
import { IBoardService } from '../../interfaces/board.service.interface';
import { BusinessAccessService } from '../business-access.service';

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
// DONE by approval, CANCELLED by project cancellation. Reorder never crosses
// these boundaries.
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
  task_creation_mode: TaskCreationMode;
  task_kanban_status: TaskKanbanStatus;
  task_display_order: number;
  consultant_id: string | null;
  consultant_full_name: string | null;
  consultant_avatar_url: string | null;
  evidences_count: number;
}

@Injectable()
export class BoardService implements IBoardService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
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
      .addSelect('t.creation_mode', 'task_creation_mode')
      .addSelect('t.kanban_status', 'task_kanban_status')
      .addSelect('t.display_order', 'task_display_order')
      .addSelect('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'consultant_full_name')
      .addSelect('cp.avatar_url', 'consultant_avatar_url')
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
          creation_mode: r.task_creation_mode,
          kanban_status: r.task_kanban_status,
          display_order: Number(r.task_display_order),
          assignee: r.consultant_id
            ? {
                consultant_id: r.consultant_id,
                full_name: r.consultant_full_name ?? '',
                avatar_url: r.consultant_avatar_url,
              }
            : null,
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

    const evidencesCount = await this.uow.taskEvidences
      .createQueryBuilder('te')
      .where('te.task_id = :taskId', { taskId })
      .andWhere('te.is_deleted = false')
      .getCount();

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
        creation_mode: task.creationMode,
        kanban_status: task.kanbanStatus,
        display_order: task.displayOrder,
        assignee: task.assignee
          ? {
              consultant_id: task.assignee.id,
              full_name: task.assignee.fullName,
              avatar_url: task.assignee.avatarUrl ?? null,
            }
          : null,
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

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async lockProjectRow(tx: IUnitOfWork, projectId: string): Promise<void> {
    // Serializes all board write paths on the same project (mirrors the
    // pattern in BacklogsService.payTasks which locks the business profile).
    // Without this, two concurrent reorder calls would each take
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

  private invalidStatusTransition(method: string, detail: string): never {
    this.logger.warn(`${method} — invalid transition | ${detail}`);
    throw new TranslatableException({
      messageKey: 'error.task.invalid_status_transition',
      errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
