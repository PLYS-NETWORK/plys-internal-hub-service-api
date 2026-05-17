import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { ITaskStatusChangedEvent, NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Project, Task } from '@database/entities';
import { ProjectStatus, TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { AssignConsultantTaskDto } from '../dto/requests/assign-consultant-task.dto';
import { ListConsultantProjectTasksDto } from '../dto/requests/list-consultant-project-tasks.dto';
import {
  ConsultantProjectTaskListItemResponseDto,
  ConsultantTaskSummaryResponseDto,
} from '../dto/responses';
import { CONSULTANT_JOINED_CACHE_TTL } from '../interfaces/consultant-joined-cache.service.interface';
import { IConsultantProjectTasksService } from '../interfaces/consultant-project-tasks.service.interface';
import { ConsultantAccessService } from './consultant-access.service';
import { ConsultantJoinedCacheService } from './consultant-joined-cache.service';

// Project statuses where claiming tasks is allowed. DONE / CANCELLED close
// the board for new self-assignment even when the consultant retains an
// ACTIVE membership row.
const ASSIGNABLE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
];

@Injectable()
export class ConsultantProjectTasksService implements IConsultantProjectTasksService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: ConsultantAccessService,
    private readonly cache: ConsultantJoinedCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(ConsultantProjectTasksService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async listTasks(
    projectId: string,
    dto: ListConsultantProjectTasksDto,
  ): Promise<PageDto<ConsultantProjectTaskListItemResponseDto>> {
    const { consultantProfile } = await this.access.resolveJoinedProject(projectId);
    const consultantId = consultantProfile.id;
    this.logger.log(
      `[${this.rid}] listTasks — start | projectId: ${projectId}, consultantId: ${consultantId}, page: ${dto.page}, limit: ${dto.limit}, keyword: ${dto.keyword ?? ''}`,
    );

    const cacheKey = this.cache.buildTaskListKey(consultantId, projectId, dto);
    const cached =
      await this.cache.read<PageDto<ConsultantProjectTaskListItemResponseDto>>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] listTasks — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const [tasks, itemCount] = await this.uow.tasks.findVisibleForConsultant({
      projectId,
      consultantId,
      keyword: dto.keyword,
      skip: dto.skip,
      take: dto.limit,
    });

    const data = tasks.map((t) => this.toListItemDto(t, consultantId));
    const page = new PageDto(data, new PageMetaDto({ pageOptionsDto: dto, itemCount }));
    await this.cache.write(cacheKey, page, CONSULTANT_JOINED_CACHE_TTL.taskList);
    this.logger.log(
      `[${this.rid}] listTasks — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return page;
  }

  /** @inheritdoc */
  public async assignTask(
    projectId: string,
    taskId: string,
    dto: AssignConsultantTaskDto,
  ): Promise<ConsultantTaskSummaryResponseDto> {
    const { project, consultantProfile } = await this.access.resolveJoinedProject(projectId);
    const consultantId = consultantProfile.id;
    this.logger.log(
      `[${this.rid}] assignTask — start | projectId: ${projectId}, taskId: ${taskId}, consultantId: ${consultantId}`,
    );

    if (!ASSIGNABLE_PROJECT_STATUSES.includes(project.status)) {
      this.logger.warn(
        `[${this.rid}] assignTask — project not assignable | projectId: ${projectId}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_joinable',
        errorCode: ERROR_CODES.PROJECT_NOT_JOINABLE,
        status: HttpStatus.CONFLICT,
      });
    }

    const updated = await this.uow.withTransaction(async (tx) => {
      const locked = await tx.tasks.lockToDoUnassignedTaskById(projectId, taskId);
      if (!locked) {
        this.logger.warn(
          `[${this.rid}] assignTask — not claimable | projectId: ${projectId}, taskId: ${taskId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task.not_claimable',
          errorCode: ERROR_CODES.TASK_NOT_CLAIMABLE,
          status: HttpStatus.CONFLICT,
        });
      }
      const now = new Date();
      locked.assignedTo = consultantId;
      locked.assignedAt = now;
      locked.dueDate = dto.dueDate;
      locked.kanbanStatus = TaskKanbanStatus.IN_PROGRESS;
      // Preserve started_at on subsequent claims so total worked time covers
      // the task's whole lifetime even across REVISION_REQUESTED round-trips.
      if (locked.startedAt === null) locked.startedAt = now;
      return tx.tasks.save(locked);
    });

    await this.cache.invalidateForConsultantProject(consultantId, projectId);
    await this.emitStatusChangedEvent(
      project,
      updated,
      consultantProfile.userId,
      TaskKanbanStatus.TO_DO,
      TaskKanbanStatus.IN_PROGRESS,
    );
    this.logger.log(
      `[${this.rid}] assignTask — complete | projectId: ${projectId}, taskId: ${taskId}`,
    );
    return this.toSummaryDto(updated);
  }

  /** @inheritdoc */
  public async unassignTask(
    projectId: string,
    taskId: string,
  ): Promise<ConsultantTaskSummaryResponseDto> {
    const { project, consultantProfile } = await this.access.resolveJoinedProject(projectId);
    const consultantId = consultantProfile.id;
    this.logger.log(
      `[${this.rid}] unassignTask — start | projectId: ${projectId}, taskId: ${taskId}, consultantId: ${consultantId}`,
    );

    const updated = await this.uow.withTransaction(async (tx) => {
      const locked = await tx.tasks.lockTaskForOwner(projectId, taskId, consultantId, [
        TaskKanbanStatus.IN_PROGRESS,
      ]);
      if (!locked) {
        await this.diagnoseOwnerLockFailure(tx, projectId, taskId, consultantId, 'unassign');
      }
      // Non-null assertion: diagnoseOwnerLockFailure always throws.
      const target = locked as Task;
      target.assignedTo = null;
      target.assignedAt = null;
      target.dueDate = null;
      target.kanbanStatus = TaskKanbanStatus.TO_DO;
      return tx.tasks.save(target);
    });

    await this.cache.invalidateForConsultantProject(consultantId, projectId);
    await this.emitStatusChangedEvent(
      project,
      updated,
      consultantProfile.userId,
      TaskKanbanStatus.IN_PROGRESS,
      TaskKanbanStatus.TO_DO,
    );
    this.logger.log(
      `[${this.rid}] unassignTask — complete | projectId: ${projectId}, taskId: ${taskId}`,
    );
    return this.toSummaryDto(updated);
  }

  /** @inheritdoc */
  public async submitForReview(
    projectId: string,
    taskId: string,
  ): Promise<ConsultantTaskSummaryResponseDto> {
    const { project, consultantProfile } = await this.access.resolveJoinedProject(projectId);
    const consultantId = consultantProfile.id;
    this.logger.log(
      `[${this.rid}] submitForReview — start | projectId: ${projectId}, taskId: ${taskId}, consultantId: ${consultantId}`,
    );

    const updated = await this.uow.withTransaction(async (tx) => {
      const locked = await tx.tasks.lockTaskForOwner(projectId, taskId, consultantId, [
        TaskKanbanStatus.IN_PROGRESS,
      ]);
      if (!locked) {
        await this.diagnoseOwnerLockFailure(tx, projectId, taskId, consultantId, 'submit');
      }
      const target = locked as Task;
      target.kanbanStatus = TaskKanbanStatus.IN_REVIEW;
      return tx.tasks.save(target);
    });

    await this.cache.invalidateForConsultantProject(consultantId, projectId);
    await this.emitStatusChangedEvent(
      project,
      updated,
      consultantProfile.userId,
      TaskKanbanStatus.IN_PROGRESS,
      TaskKanbanStatus.IN_REVIEW,
    );
    this.logger.log(
      `[${this.rid}] submitForReview — complete | projectId: ${projectId}, taskId: ${taskId}`,
    );
    return this.toSummaryDto(updated);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Lock returned null — distinguish 404 / 403 / 409 by re-reading the row
   * without a status/owner filter and inspecting the actual state. Always
   * throws; the call site treats the return type as `never`.
   */
  private async diagnoseOwnerLockFailure(
    tx: { tasks: { findOne: (opts: Record<string, unknown>) => Promise<Task | null> } },
    projectId: string,
    taskId: string,
    consultantId: string,
    flow: 'unassign' | 'submit',
  ): Promise<never> {
    const task = await tx.tasks.findOne({ where: { id: taskId, projectId } });
    if (!task) {
      this.logger.warn(
        `[${this.rid}] ${flow} — task not found | projectId: ${projectId}, taskId: ${taskId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    if (task.assignedTo !== consultantId) {
      this.logger.warn(
        `[${this.rid}] ${flow} — task not owned by consultant | taskId: ${taskId}, consultantId: ${consultantId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.not_owned_by_consultant',
        errorCode: ERROR_CODES.TASK_NOT_OWNED_BY_CONSULTANT,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const errorCode =
      flow === 'unassign'
        ? ERROR_CODES.TASK_INVALID_STATE_FOR_UNASSIGN
        : ERROR_CODES.TASK_INVALID_STATE_FOR_SUBMIT;
    const messageKey =
      flow === 'unassign'
        ? 'error.task.invalid_state_for_unassign'
        : 'error.task.invalid_state_for_submit';
    this.logger.warn(
      `[${this.rid}] ${flow} — invalid status | taskId: ${taskId}, status: ${task.kanbanStatus}`,
    );
    throw new TranslatableException({
      messageKey,
      errorCode,
      status: HttpStatus.CONFLICT,
    });
  }

  private async emitStatusChangedEvent(
    project: Project,
    task: Task,
    consultantUserId: string,
    oldStatus: TaskKanbanStatus,
    newStatus: TaskKanbanStatus,
  ): Promise<void> {
    try {
      const businessProfile = await this.uow.businessProfiles.findOne({
        where: { id: project.businessId },
      });
      if (!businessProfile) {
        this.logger.warn(
          `[${this.rid}] emitStatusChangedEvent — business profile missing, skipping notification | projectId: ${project.id}, businessId: ${project.businessId}`,
        );
        return;
      }
      const payload: ITaskStatusChangedEvent = {
        task_id: task.id,
        task_code: task.code,
        task_title: task.title,
        project_id: project.id,
        old_status: oldStatus,
        new_status: newStatus,
        consultant_user_id: consultantUserId,
        business_user_id: businessProfile.userId,
      };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.TASK_STATUS_CHANGED, payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${this.rid}] emitStatusChangedEvent — failed | taskId: ${task.id}, error: ${message}`,
      );
    }
  }

  // ─── Mapping ───────────────────────────────────────────────────────────────

  private toListItemDto(
    task: Task,
    consultantId: string,
  ): ConsultantProjectTaskListItemResponseDto {
    return plainToInstance(
      ConsultantProjectTaskListItemResponseDto,
      {
        id: task.id,
        code: task.code,
        title: task.title,
        kanban_status: task.kanbanStatus,
        price: Number(task.price),
        due_date: task.dueDate,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        assigned_at: task.assignedAt,
        is_mine: task.assignedTo === consultantId,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toSummaryDto(task: Task): ConsultantTaskSummaryResponseDto {
    return plainToInstance(
      ConsultantTaskSummaryResponseDto,
      {
        id: task.id,
        code: task.code,
        title: task.title,
        kanban_status: task.kanbanStatus,
        price: Number(task.price),
        due_date: task.dueDate,
        assigned_at: task.assignedAt,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        project_id: task.projectId,
      },
      { excludeExtraneousValues: true },
    );
  }
}
