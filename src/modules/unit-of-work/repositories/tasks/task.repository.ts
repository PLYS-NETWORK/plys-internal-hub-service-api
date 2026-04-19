import { AbstractRepository } from '@common/repositories';
import { Task } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskRepository } from './interfaces';

@Injectable()
export class TaskRepository extends AbstractRepository<Task> implements ITaskRepository {
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Task, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskRepository(manager) as this;
  }
}
