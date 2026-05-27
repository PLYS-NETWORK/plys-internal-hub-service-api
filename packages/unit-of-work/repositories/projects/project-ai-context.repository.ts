import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ProjectAiContext } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IProjectAiContextRepository } from './interfaces';

@Injectable()
export class ProjectAiContextRepository
  extends AbstractRepository<ProjectAiContext>
  implements IProjectAiContextRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectAiContext, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectAiContextRepository(manager) as this;
  }
}
