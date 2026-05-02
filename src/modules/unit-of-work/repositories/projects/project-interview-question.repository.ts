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

  /** @inheritdoc */
  public async countDistinctProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('q')
      .select('COUNT(DISTINCT q.project_id)', 'count')
      .where('q.project_id IN (:...projectIds)', { projectIds })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }
}
