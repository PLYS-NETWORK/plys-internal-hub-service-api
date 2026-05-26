import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { TaskHistory } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { ITaskHistoryRepository } from './interfaces';

@Injectable()
export class TaskHistoryRepository
  extends AbstractRepository<TaskHistory>
  implements ITaskHistoryRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskHistory, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskHistoryRepository(manager) as this;
  }
}
