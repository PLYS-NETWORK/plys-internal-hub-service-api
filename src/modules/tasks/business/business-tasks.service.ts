import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectStatus, TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Not } from 'typeorm';

import {
  AssignTaskDto,
  CreateTaskDto,
  ReorderTasksDto,
  UpdateTaskBusinessStatusDto,
} from '../dto/requests';
import { TaskResponseDto } from '../dto/responses';
import { TASK_ERRORS } from '../shared/constants/task-error-messages.constant';
import { TaskAccessService } from '../shared/services/task-access.service';
import { TaskMapperService } from '../shared/services/task-mapper.service';
import { BusinessTaskStatusStrategy } from './business-task-status.strategy';
import { IBusinessTasksService } from './interfaces/business-tasks.service.interface';

@Injectable()
export class BusinessTasksService implements IBusinessTasksService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly taskAccess: TaskAccessService,
    private readonly taskMapper: TaskMapperService,
    private readonly statusStrategy: BusinessTaskStatusStrategy,
  ) {
    this.logger = new AppLogger(BusinessTasksService.name, requestContext);
  }

  /** @inheritdoc */
  public async createDraftTask(dto: CreateTaskDto): Promise<TaskResponseDto> {
    const businessId = await this.taskAccess.resolveBusinessId();
    this.logger.log(`createDraftTask — start | projectId: ${dto.projectId}`);

    const project = await this.uow.projects.findByIdAndBusinessId(dto.projectId, businessId);
    if (!project) {
      throw this.taskAccess.projectNotFound(dto.projectId, businessId);
    }

    if (project.status !== ProjectStatus.IN_PROGRESS) {
      this.logger.warn(
        `createDraftTask — project not in_progress | projectId: ${dto.projectId}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: TASK_ERRORS.PROJECT_NOT_IN_PROGRESS,
        errorCode: ERROR_CODES.TASK_PROJECT_NOT_IN_PROGRESS,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    const task = this.uow.tasks.create({
      projectId: dto.projectId,
      title: dto.title,
      description: dto.description ?? null,
      price: dto.price,
      difficultyLevel: dto.difficultyLevel,
      kanbanStatus: TaskKanbanStatus.DRAFT,
    });
    const saved = await this.uow.tasks.save(task);

    this.logger.log(`createDraftTask — complete | taskId: ${saved.id}`);
    return this.taskMapper.toTaskResponseDto(saved);
  }

  /** @inheritdoc */
  public async updateStatus(
    taskId: string,
    dto: UpdateTaskBusinessStatusDto,
  ): Promise<TaskResponseDto> {
    const businessId = await this.taskAccess.resolveBusinessId();
    this.logger.log(`updateStatus — start | taskId: ${taskId}, target: ${dto.status}`);

    const task = await this.taskAccess.findTaskOwnedByBusiness(taskId, businessId);
    const saved = await this.statusStrategy.transition(task, dto.status);

    this.logger.log(`updateStatus — complete | taskId: ${taskId}, status: ${saved.kanbanStatus}`);
    return this.taskMapper.toTaskResponseDto(saved);
  }

  /** @inheritdoc */
  public async assignTask(taskId: string, dto: AssignTaskDto): Promise<TaskResponseDto> {
    const businessId = await this.taskAccess.resolveBusinessId();
    this.logger.log(`assignTask — start | taskId: ${taskId}, consultantId: ${dto.consultantId}`);

    const task = await this.taskAccess.findTaskOwnedByBusiness(taskId, businessId);

    if (task.kanbanStatus !== TaskKanbanStatus.TO_DO || task.assignedTo !== null) {
      this.logger.warn(
        `assignTask — task not assignable | taskId: ${taskId}, status: ${task.kanbanStatus}, assignedTo: ${task.assignedTo}`,
      );
      throw new TranslatableException({
        messageKey: TASK_ERRORS.ALREADY_ASSIGNED,
        errorCode: ERROR_CODES.TASK_ALREADY_ASSIGNED,
        status: HttpStatus.CONFLICT,
      });
    }

    await this.taskAccess.verifyProjectMembership(task.projectId, dto.consultantId);

    task.assignedTo = dto.consultantId;
    task.assignedAt = new Date();
    task.kanbanStatus = TaskKanbanStatus.ASSIGNED;
    const saved = await this.uow.tasks.save(task);

    this.logger.log(`assignTask — complete | taskId: ${taskId}, consultantId: ${dto.consultantId}`);
    return this.taskMapper.toTaskResponseDto(saved);
  }

  /** @inheritdoc */
  public async reorderTasks(dto: ReorderTasksDto): Promise<void> {
    const businessId = await this.taskAccess.resolveBusinessId();
    this.logger.log(`reorderTasks — start | count: ${dto.tasks.length}`);

    const ids = dto.tasks.map((t) => t.id);
    const tasks = await this.uow.tasks.find({
      where: ids.map((id) => ({ id })),
      relations: { project: true },
    });

    if (tasks.length !== ids.length) {
      throw this.taskAccess.taskNotFound('one or more tasks');
    }

    for (const task of tasks) {
      if (task.project.businessId !== businessId) {
        throw this.taskAccess.taskNotFound(task.id);
      }
    }

    await this.uow.withTransaction(async (txUow) => {
      for (const item of dto.tasks) {
        await txUow.tasks.update(item.id, { displayOrder: item.displayOrder });
      }
    });

    this.logger.log(`reorderTasks — complete | count: ${dto.tasks.length}`);
  }

  /** @inheritdoc */
  public async listKanbanTasks(projectId: string): Promise<TaskResponseDto[]> {
    const businessId = await this.taskAccess.resolveBusinessId();
    this.logger.log(`listKanbanTasks — start | projectId: ${projectId}`);

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessId);
    if (!project) {
      throw this.taskAccess.projectNotFound(projectId, businessId);
    }

    const tasks = await this.uow.tasks.find({
      where: { projectId, kanbanStatus: Not(TaskKanbanStatus.DRAFT) },
      order: { displayOrder: 'ASC' },
    });

    this.logger.log(
      `listKanbanTasks — complete | projectId: ${projectId}, returned: ${tasks.length}`,
    );
    return tasks.map((t) => this.taskMapper.toTaskResponseDto(t));
  }

  /** @inheritdoc */
  public async listDraftTasks(projectId: string): Promise<TaskResponseDto[]> {
    const businessId = await this.taskAccess.resolveBusinessId();
    this.logger.log(`listDraftTasks — start | projectId: ${projectId}`);

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessId);
    if (!project) {
      throw this.taskAccess.projectNotFound(projectId, businessId);
    }

    const tasks = await this.uow.tasks.find({
      where: { projectId, kanbanStatus: TaskKanbanStatus.DRAFT },
      order: { displayOrder: 'ASC' },
    });

    this.logger.log(
      `listDraftTasks — complete | projectId: ${projectId}, returned: ${tasks.length}`,
    );
    return tasks.map((t) => this.taskMapper.toTaskResponseDto(t));
  }
}
