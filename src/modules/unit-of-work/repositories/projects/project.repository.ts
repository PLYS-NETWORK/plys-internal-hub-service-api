import { AbstractRepository } from '@common/repositories';
import { Project } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IProjectRepository } from './interfaces';

@Injectable()
export class ProjectRepository
  extends AbstractRepository<Project>
  implements IProjectRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Project, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectRepository(manager) as this;
  }
}
