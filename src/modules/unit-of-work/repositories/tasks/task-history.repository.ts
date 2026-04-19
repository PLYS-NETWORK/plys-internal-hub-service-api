import { AbstractRepository } from '@common/repositories';
import { TaskHistory } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
