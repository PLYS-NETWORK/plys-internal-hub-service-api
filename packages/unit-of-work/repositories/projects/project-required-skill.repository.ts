import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ProjectRequiredSkill } from '@plys/libraries/database/entities';
import { ProjectMemberStatus } from '@plys/libraries/database/enums';
import { EntityManager } from 'typeorm';

import { IProjectRequiredSkillRepository } from './interfaces';

@Injectable()
export class ProjectRequiredSkillRepository
  extends AbstractRepository<ProjectRequiredSkill>
  implements IProjectRequiredSkillRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectRequiredSkill, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectRequiredSkillRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findSkillIdsByProjectId(projectId: string): Promise<string[]> {
    const rows = await this.createQueryBuilder('prs')
      .select('prs.skill_id', 'skill_id')
      .where('prs.project_id = :projectId', { projectId })
      .getRawMany<{ skill_id: string }>();
    return rows.map((r) => r.skill_id);
  }

  /** @inheritdoc */
  public async findWithSkillByProjectId(projectId: string): Promise<ProjectRequiredSkill[]> {
    return this.createQueryBuilder('prs')
      .innerJoinAndSelect('prs.skill', 'skill')
      .where('prs.project_id = :projectId', { projectId })
      .orderBy('skill.name', 'ASC')
      .getMany();
  }

  /** @inheritdoc */
  public async countActiveProjectsByConsultantGroupedBySkill(
    consultantId: string,
    skillIds: string[],
  ): Promise<Map<string, number>> {
    if (skillIds.length === 0) return new Map();
    const rows = await this.createQueryBuilder('prs')
      .innerJoin(
        'project_members',
        'pm',
        'pm.project_id = prs.project_id AND pm.consultant_id = :consultantId AND pm.status = :memberStatus',
        { consultantId, memberStatus: ProjectMemberStatus.ACTIVE },
      )
      .innerJoin(
        'projects',
        'project',
        'project.id = prs.project_id AND project.deleted_at IS NULL',
      )
      .select('prs.skill_id', 'skill_id')
      .addSelect('COUNT(DISTINCT prs.project_id)::int', 'count')
      .where('prs.skill_id IN (:...skillIds)', { skillIds })
      .groupBy('prs.skill_id')
      .getRawMany<{ skill_id: string; count: number }>();
    const out = new Map<string, number>();
    for (const row of rows) out.set(row.skill_id, Number(row.count));
    return out;
  }
}
