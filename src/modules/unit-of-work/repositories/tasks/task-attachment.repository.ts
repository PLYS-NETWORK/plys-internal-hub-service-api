import { AbstractRepository } from '@common/repositories';
import { TaskAttachment } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskAttachmentRepository } from './interfaces';

@Injectable()
export class TaskAttachmentRepository
  extends AbstractRepository<TaskAttachment>
  implements ITaskAttachmentRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskAttachment, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskAttachmentRepository(manager) as this;
  }
}
