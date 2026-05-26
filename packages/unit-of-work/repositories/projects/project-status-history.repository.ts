import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ProjectStatusHistory } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IProjectStatusHistoryRepository } from './interfaces';

@Injectable()
export class ProjectStatusHistoryRepository
  extends AbstractRepository<ProjectStatusHistory>
  implements IProjectStatusHistoryRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectStatusHistory, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectStatusHistoryRepository(manager) as this;
  }
}
