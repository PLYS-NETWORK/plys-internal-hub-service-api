import { AbstractRepository } from '@common/repositories';
import { ProjectRequiredSkill } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
}
