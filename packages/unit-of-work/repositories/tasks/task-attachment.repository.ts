import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { TaskAttachment } from '@plys/libraries/database/entities';
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
