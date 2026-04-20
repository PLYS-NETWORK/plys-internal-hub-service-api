import { AbstractRepository } from '@common/repositories';
import { ProjectInterviewQuestion } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IProjectInterviewQuestionRepository } from './interfaces';

@Injectable()
export class ProjectInterviewQuestionRepository
  extends AbstractRepository<ProjectInterviewQuestion>
  implements IProjectInterviewQuestionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectInterviewQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectInterviewQuestionRepository(manager) as this;
  }
}
