import { AbstractRepository } from '@common/repositories';
import { ProjectMember } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IProjectMemberRepository } from './interfaces';

@Injectable()
export class ProjectMemberRepository
  extends AbstractRepository<ProjectMember>
  implements IProjectMemberRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectMember, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectMemberRepository(manager) as this;
  }
}
