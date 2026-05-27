import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ProjectMember } from '@plys/libraries/database/entities';
import { ProjectMemberStatus, ProjectStatus } from '@plys/libraries/database/enums';
import { EntityManager } from 'typeorm';

import { IBusinessTeamConsultantRow, IProjectMemberRepository } from './interfaces';

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
  public async countDistinctActiveConsultantsByProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('pm')
      .select('COUNT(DISTINCT pm.consultant_id)', 'count')
      .where('pm.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async countDistinctNewConsultantsByProjectIdsBetween(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('pm')
      .select('COUNT(DISTINCT pm.consultant_id)', 'count')
      .where('pm.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pm.joined_at >= :from', { from })
      .andWhere('pm.joined_at <= :to', { to })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async findByProjectAndConsultant(
    projectId: string,
    consultantId: string,
  ): Promise<ProjectMember | null> {
    return this.findOne({ where: { projectId, consultantId } });
  }

  /** @inheritdoc */
  public async activate(member: ProjectMember): Promise<ProjectMember> {
    member.status = ProjectMemberStatus.ACTIVE;
    member.joinedAt = new Date();
    member.leftAt = null;
    return this.save(member);
  }

  /** @inheritdoc */
  public async markLeft(member: ProjectMember): Promise<ProjectMember> {
    member.status = ProjectMemberStatus.LEFT;
    member.leftAt = new Date();
    return this.save(member);
  }

  /** @inheritdoc */
  public async findActiveProjectIdsByConsultantId(
    consultantId: string,
    projectIds: string[],
  ): Promise<Set<string>> {
    if (projectIds.length === 0) return new Set();
    const rows = await this.createQueryBuilder('pm')
      .select('pm.project_id', 'project_id')
      .where('pm.consultant_id = :consultantId', { consultantId })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .andWhere('pm.project_id IN (:...projectIds)', { projectIds })
      .getRawMany<{ project_id: string }>();
    return new Set(rows.map((r) => r.project_id));
  }

  /** @inheritdoc */
  public async findActiveProjectIdsByConsultantOnly(consultantId: string): Promise<string[]> {
    const rows = await this.createQueryBuilder('pm')
      .select('pm.project_id', 'project_id')
      .where('pm.consultant_id = :consultantId', { consultantId })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .getRawMany<{ project_id: string }>();
    return rows.map((r) => r.project_id);
  }

  /** @inheritdoc */
  public async findActiveByConsultantIdLightweight(
    consultantId: string,
    statusFilter: ProjectStatus | undefined,
    limit: number,
  ): Promise<ProjectMember[]> {
    const qb = this.createQueryBuilder('pm')
      .innerJoinAndSelect('pm.project', 'project')
      .where('pm.consultant_id = :consultantId', { consultantId })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .andWhere('project.deleted_at IS NULL');

    if (statusFilter) {
      qb.andWhere('project.status = :projectStatus', { projectStatus: statusFilter });
    }

    return qb.orderBy('pm.joined_at', 'DESC').addOrderBy('project.id', 'ASC').take(limit).getMany();
  }

  /** @inheritdoc */
  public async findActiveConsultantsByProjectIds(
    projectIds: string[],
    limit: number,
  ): Promise<IBusinessTeamConsultantRow[]> {
    if (projectIds.length === 0) return [];
    const rows = await this.createQueryBuilder('pm')
      .innerJoin('consultant_profiles', 'cp', 'cp.id = pm.consultant_id')
      .select('pm.consultant_id', 'consultant_id')
      .addSelect('cp.full_name', 'full_name')
      .addSelect('cp.avatar_url', 'avatar_url')
      .addSelect('COUNT(DISTINCT pm.project_id)::int', 'active_projects_count')
      .where('pm.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pm.status = :status', { status: ProjectMemberStatus.ACTIVE })
      .groupBy('pm.consultant_id')
      .addGroupBy('cp.full_name')
      .addGroupBy('cp.avatar_url')
      .orderBy('cp.full_name', 'ASC')
      .limit(limit)
      .getRawMany<{
        consultant_id: string;
        full_name: string;
        avatar_url: string | null;
        active_projects_count: number;
      }>();
    return rows.map((r) => ({
      consultant_id: r.consultant_id,
      full_name: r.full_name,
      avatar_url: r.avatar_url,
      active_projects_count: Number(r.active_projects_count),
    }));
  }
}
