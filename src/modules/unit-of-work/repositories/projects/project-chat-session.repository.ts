import { AbstractRepository } from '@common/repositories';
import { ProjectChatSession } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IProjectChatSessionRepository } from './interfaces';

@Injectable()
export class ProjectChatSessionRepository
  extends AbstractRepository<ProjectChatSession>
  implements IProjectChatSessionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectChatSession, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectChatSessionRepository(manager) as this;
  }
}
