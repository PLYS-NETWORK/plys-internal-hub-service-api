import { AbstractRepository } from '@common/repositories';
import { TaskComment } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskCommentRepository } from './interfaces';

@Injectable()
export class TaskCommentRepository
  extends AbstractRepository<TaskComment>
  implements ITaskCommentRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskComment, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskCommentRepository(manager) as this;
  }
}
