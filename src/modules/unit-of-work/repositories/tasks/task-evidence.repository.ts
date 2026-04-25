import { AbstractRepository } from '@common/repositories';
import { TaskEvidence } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskEvidenceRepository } from './interfaces';

@Injectable()
export class TaskEvidenceRepository
  extends AbstractRepository<TaskEvidence>
  implements ITaskEvidenceRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskEvidence, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskEvidenceRepository(manager) as this;
  }
}
