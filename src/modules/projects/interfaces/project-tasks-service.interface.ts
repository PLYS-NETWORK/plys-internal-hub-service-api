import { Task } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

import { TaskItemDto } from '../dto/requests/task-item.dto';

export interface IProjectTasksService {
  findByProjectId(projectId: string, uow?: IUnitOfWork): Promise<Task[]>;

  createForProject(projectId: string, items: TaskItemDto[], uow: IUnitOfWork): Promise<Task[]>;

  replaceForProject(projectId: string, items: TaskItemDto[], uow: IUnitOfWork): Promise<Task[]>;
}
