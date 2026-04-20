import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Task } from '@database/entities';
import { TaskCreationMode } from '@database/enums/task-creation-mode.enum';
import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { TaskKanbanStatus } from '@database/enums/task-kanban-status.enum';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, Logger } from '@nestjs/common';

import { TaskItemDto } from '../dto/requests/task-item.dto';
import { IProjectTasksService } from '../interfaces/project-tasks-service.interface';

@Injectable()
export class ProjectTasksService implements IProjectTasksService {
  private readonly logger = new Logger(ProjectTasksService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async findByProjectId(projectId: string, uow?: IUnitOfWork): Promise<Task[]> {
    return (uow ?? this.uow).tasks.find({
      where: { projectId },
      order: { displayOrder: 'ASC' },
    });
  }

  public async createForProject(
    projectId: string,
    items: TaskItemDto[],
    uow: IUnitOfWork,
  ): Promise<Task[]> {
    if (items.length === 0) return [];

    this.logger.log(
      `[${this.rid}] createForProject — start | projectId: ${projectId}, count: ${items.length}`,
    );

    const entities = items.map((item, index) =>
      uow.tasks.create({
        projectId,
        title: item.title,
        description: item.description ?? null,
        price: item.price,
        difficultyLevel: item.difficultyLevel ?? TaskDifficulty.MEDIUM,
        displayOrder: item.displayOrder ?? index + 1,
        creationMode: TaskCreationMode.MANUAL,
        kanbanStatus: TaskKanbanStatus.DRAFT,
      }),
    );
    const saved = await uow.tasks.save(entities);

    this.logger.log(
      `[${this.rid}] createForProject — complete | projectId: ${projectId}, inserted: ${saved.length}`,
    );
    return saved;
  }

  public async replaceForProject(
    projectId: string,
    items: TaskItemDto[],
    uow: IUnitOfWork,
  ): Promise<Task[]> {
    this.logger.log(
      `[${this.rid}] replaceForProject — start | projectId: ${projectId}, count: ${items.length}`,
    );

    await uow.tasks.delete({ projectId } as never);
    const result = await this.createForProject(projectId, items, uow);

    this.logger.log(
      `[${this.rid}] replaceForProject — complete | projectId: ${projectId}, inserted: ${result.length}`,
    );
    return result;
  }
}
