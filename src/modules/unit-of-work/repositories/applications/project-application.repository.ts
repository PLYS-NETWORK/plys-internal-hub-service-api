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

  /** @inheritdoc */
  public async countByProjectIds(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();

    const rows = await this.createQueryBuilder('pa')
      .select('pa.project_id', 'project_id')
      .addSelect('COUNT(*)', 'count')
      .where('pa.project_id IN (:...projectIds)', { projectIds })
      .groupBy('pa.project_id')
      .getRawMany<{ project_id: string; count: string }>();

    const byProject = new Map<string, number>();
    for (const row of rows) {
      byProject.set(row.project_id, Number(row.count));
    }
    return byProject;
  }
}
