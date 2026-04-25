import { AbstractRepository } from '@common/repositories';
import { TaskEvidenceAttachment } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskEvidenceAttachmentRepository } from './interfaces';

@Injectable()
export class TaskEvidenceAttachmentRepository
  extends AbstractRepository<TaskEvidenceAttachment>
  implements ITaskEvidenceAttachmentRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskEvidenceAttachment, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskEvidenceAttachmentRepository(manager) as this;
  }
}
