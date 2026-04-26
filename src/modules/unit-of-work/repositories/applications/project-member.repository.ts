import { AbstractRepository } from '@common/repositories';
import { ProjectMember } from '@database/entities';
import { ProjectMemberStatus } from '@database/enums';
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

  /** @inheritdoc */
  public async countActiveByProjectIds(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();

    const rows = await this.createQueryBuilder('pm')
      .select('pm.project_id', 'project_id')
      .addSelect('COUNT(*)', 'count')
      .where('pm.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .groupBy('pm.project_id')
      .getRawMany<{ project_id: string; count: string }>();

    const byProject = new Map<string, number>();
    for (const row of rows) {
      byProject.set(row.project_id, Number(row.count));
    }
    return byProject;
  }
}
