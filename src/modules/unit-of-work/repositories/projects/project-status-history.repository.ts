import { AbstractRepository } from '@common/repositories';
import { ProjectStatusHistory } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
