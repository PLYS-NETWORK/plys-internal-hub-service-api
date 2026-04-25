import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { Not } from 'typeorm';

import { UpdateTaskConsultantStatusDto } from '../dto/requests';
import { ConsultantTaskResponseDto, TaskResponseDto } from '../dto/responses';
import { TaskAccessService } from '../shared/services/task-access.service';
import { TaskMapperService } from '../shared/services/task-mapper.service';
import { ConsultantTaskStatusStrategy } from './consultant-task-status.strategy';
import { IConsultantTasksService } from './interfaces/consultant-tasks.service.interface';

@Injectable()
export class ConsultantTasksService implements IConsultantTasksService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly taskAccess: TaskAccessService,
    private readonly taskMapper: TaskMapperService,
    private readonly statusStrategy: ConsultantTaskStatusStrategy,
  ) {
    this.logger = new AppLogger(ConsultantTasksService.name, requestContext);
  }

  /** @inheritdoc */
  public async listProjectTasks(projectId: string): Promise<ConsultantTaskResponseDto[]> {
    const consultantProfile = await this.taskAccess.resolveConsultantProfile();
    this.logger.log(
      `listProjectTasks — start | projectId: ${projectId}, consultantId: ${consultantProfile.id}`,
    );

    await this.taskAccess.verifyProjectMembership(projectId, consultantProfile.id);

    const tasks = await this.uow.tasks.find({
      where: { projectId, kanbanStatus: Not(TaskKanbanStatus.DRAFT) },
      order: { displayOrder: 'ASC' },
    });

    this.logger.log(
      `listProjectTasks — complete | projectId: ${projectId}, returned: ${tasks.length}`,
    );
    return tasks.map((t) => this.taskMapper.toConsultantTaskResponseDto(t));
  }

  /** @inheritdoc */
  public async updateStatus(
    taskId: string,
    dto: UpdateTaskConsultantStatusDto,
  ): Promise<TaskResponseDto> {
    this.logger.log(`updateStatus — start | taskId: ${taskId}, target: ${dto.status}`);

    const task = await this.taskAccess.findTaskOrThrow(taskId);
    const saved = await this.statusStrategy.transition(task, dto.status);

    this.logger.log(`updateStatus — complete | taskId: ${taskId}, status: ${saved.kanbanStatus}`);
    return this.taskMapper.toTaskResponseDto(saved);
  }
}
