import { AbstractRepository } from '@common/repositories';
import { ProjectMember } from '@database/entities';
import { ProjectMemberStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IActiveMemberRow, IProjectMemberRepository } from './interfaces';

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

  /** @inheritdoc */
  public async countActiveTotalByProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('pm')
      .select('COUNT(*)', 'count')
      .where('pm.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async findActiveByProjectIdWithUser(projectId: string): Promise<IActiveMemberRow[]> {
    const rows = await this.createQueryBuilder('pm')
      .innerJoin('pm.consultant', 'cp')
      .innerJoin('cp.user', 'u')
      .select('u.id', 'user_id')
      .addSelect('cp.full_name', 'full_name')
      .addSelect('pm.joined_at', 'joined_at')
      .addSelect('u.last_login_at', 'last_login_at')
      .where('pm.project_id = :projectId', { projectId })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .orderBy('pm.joined_at', 'ASC')
      .getRawMany<{
        user_id: string;
        full_name: string;
        joined_at: Date;
        last_login_at: Date | null;
      }>();

    return rows.map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      joined_at: r.joined_at,
      last_login_at: r.last_login_at,
    }));
  }
}
