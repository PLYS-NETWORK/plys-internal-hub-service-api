import { AbstractRepository } from '@common/repositories';
import { TaskResult } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskResultRepository } from './interfaces';

@Injectable()
export class TaskResultRepository
  extends AbstractRepository<TaskResult>
  implements ITaskResultRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskResult, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskResultRepository(manager) as this;
  }
}
