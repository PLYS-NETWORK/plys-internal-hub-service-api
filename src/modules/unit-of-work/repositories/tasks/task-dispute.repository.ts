import { AbstractRepository } from '@common/repositories';
import { TaskDispute } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskDisputeRepository } from './interfaces';

@Injectable()
export class TaskDisputeRepository
  extends AbstractRepository<TaskDispute>
  implements ITaskDisputeRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskDispute, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskDisputeRepository(manager) as this;
  }
}
