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
import { In } from 'typeorm';

import { AssignTaskDto, UpdateTaskPositionsDto } from '../../dto/requests';
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

interface IBoardTaskRow {
  task_id: string;
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
  ) {
    this.logger = new AppLogger(BoardService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async listTasks(projectId: string): Promise<BoardTaskResponseDto[]> {
    this.logger.log(`[${this.rid}] listTasks — start | projectId: ${projectId}`);
    await this.access.resolveOwnedProject(projectId);

    const rows = await this.uow.tasks
      .createQueryBuilder('t')
      .leftJoin('t.assignee', 'cp')
      .select('t.id', 'task_id')
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

    this.logger.log(
      `[${this.rid}] listTasks — complete | projectId: ${projectId}, count: ${data.length}`,
    );
    return data;
  }

  /** @inheritdoc */
  public async updatePositions(projectId: string, dto: UpdateTaskPositionsDto): Promise<void> {
    this.logger.log(
      `[${this.rid}] updatePositions — start | projectId: ${projectId}, count: ${dto.tasks.length}`,
    );
    await this.access.resolveOwnedProject(projectId);

    const ids = dto.tasks.map((t) => t.taskId);
    await this.uow.withTransaction(async (tx) => {
      const existing = await tx.tasks.find({
        where: { id: In(ids), projectId },
      });
      if (existing.length !== ids.length) {
        throw new TranslatableException({
          messageKey: 'error.task.invalid_status_transition',
          errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
      const draft = existing.find((t) => t.kanbanStatus === TaskKanbanStatus.DRAFT);
      if (draft) {
        throw new TranslatableException({
          messageKey: 'error.task.invalid_status_transition',
          errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }

      const positionById = new Map(dto.tasks.map((t) => [t.taskId, t]));
      for (const task of existing) {
        const update = positionById.get(task.id)!;
        if (update.kanbanStatus === TaskKanbanStatus.DRAFT) {
          throw new TranslatableException({
            messageKey: 'error.task.invalid_status_transition',
            errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }
        task.kanbanStatus = update.kanbanStatus;
        task.displayOrder = update.displayOrder;
      }
      await tx.tasks.save(existing);
    });

    this.logger.log(
      `[${this.rid}] updatePositions — complete | projectId: ${projectId}, updated: ${ids.length}`,
    );
  }

  /** @inheritdoc */
  public async getTaskDetail(
    projectId: string,
    taskId: string,
  ): Promise<BoardTaskDetailResponseDto> {
    this.logger.log(
      `[${this.rid}] getTaskDetail — start | projectId: ${projectId}, taskId: ${taskId}`,
    );
    await this.access.resolveOwnedProject(projectId);

    const task = await this.uow.tasks.findOne({
      where: { id: taskId, projectId },
      relations: { assignee: true },
    });
    if (!task || task.kanbanStatus === TaskKanbanStatus.DRAFT) {
      this.logger.warn(`[${this.rid}] getTaskDetail — not found or draft | taskId: ${taskId}`);
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

    this.logger.log(`[${this.rid}] getTaskDetail — complete | taskId: ${taskId}`);
    return plainToInstance(
      BoardTaskDetailResponseDto,
      {
        id: task.id,
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
      `[${this.rid}] assign — start | projectId: ${projectId}, taskId: ${taskId}, consultantId: ${dto.consultantId}`,
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
    });

    this.logger.log(`[${this.rid}] assign — complete | taskId: ${taskId}`);
  }

  /** @inheritdoc */
  public async unassign(projectId: string, taskId: string): Promise<void> {
    this.logger.log(`[${this.rid}] unassign — start | projectId: ${projectId}, taskId: ${taskId}`);
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

    this.logger.log(`[${this.rid}] unassign — complete | taskId: ${taskId}`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

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
