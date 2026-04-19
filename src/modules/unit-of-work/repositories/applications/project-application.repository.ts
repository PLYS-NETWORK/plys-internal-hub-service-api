import { AbstractRepository } from '@common/repositories';
import { ProjectApplication } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IProjectApplicationRepository } from './interfaces';

@Injectable()
export class ProjectApplicationRepository
  extends AbstractRepository<ProjectApplication>
  implements IProjectApplicationRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectApplication, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectApplicationRepository(manager) as this;
  }
}
