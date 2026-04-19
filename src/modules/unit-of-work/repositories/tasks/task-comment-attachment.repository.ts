import { AbstractRepository } from '@common/repositories';
import { TaskCommentAttachment } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskCommentAttachmentRepository } from './interfaces';

@Injectable()
export class TaskCommentAttachmentRepository
  extends AbstractRepository<TaskCommentAttachment>
  implements ITaskCommentAttachmentRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskCommentAttachment, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskCommentAttachmentRepository(manager) as this;
  }
}
