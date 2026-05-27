import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { TaskResultAttachment } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { ITaskResultAttachmentRepository } from './interfaces';

@Injectable()
export class TaskResultAttachmentRepository
  extends AbstractRepository<TaskResultAttachment>
  implements ITaskResultAttachmentRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskResultAttachment, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskResultAttachmentRepository(manager) as this;
  }
}
