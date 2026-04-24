import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Task } from '@database/entities';
import { TaskCreationMode, TaskDifficulty, TaskKanbanStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { TaskItemDto } from '../dto/requests/task-item.dto';
import { IProjectTasksService } from '../interfaces/project-tasks-service.interface';

@Injectable()
export class ProjectTasksService implements IProjectTasksService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ProjectTasksService.name, requestContext);
  }

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

    this.logger.log(`createForProject — start | projectId: ${projectId}, count: ${items.length}`);

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
      `createForProject — complete | projectId: ${projectId}, inserted: ${saved.length}`,
    );
    return saved;
  }

  public async replaceForProject(
    projectId: string,
    items: TaskItemDto[],
    uow: IUnitOfWork,
  ): Promise<Task[]> {
    this.logger.log(`replaceForProject — start | projectId: ${projectId}, count: ${items.length}`);

    await uow.tasks.delete({ projectId } as never);
    const result = await this.createForProject(projectId, items, uow);

    this.logger.log(
      `replaceForProject — complete | projectId: ${projectId}, inserted: ${result.length}`,
    );
    return result;
  }
}
