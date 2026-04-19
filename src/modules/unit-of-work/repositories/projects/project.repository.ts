import { Order } from '@common/dto/page-options.dto';
import { AbstractRepository } from '@common/repositories';
import { Project } from '@database/entities';
import { ProjectStatus } from '@database/enums/project-status.enum';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IProjectRepository } from './interfaces';

// Columns the caller is allowed to sort by. Any unrecognised value falls back
// to the default (created_at) to prevent SQL injection via the sort_by param.
const SORTABLE_COLUMNS: Record<string, string> = {
  title: 'project.title',
  status: 'project.status',
  required_consultants: 'project.required_consultants',
  created_at: 'project.created_at',
};
const DEFAULT_SORT_COLUMN = 'project.created_at';

@Injectable()
export class ProjectRepository extends AbstractRepository<Project> implements IProjectRepository {
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Project, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectRepository(manager) as this;
  }

  public async findByBusinessId(
    businessId: string,
    skip: number,
    take: number,
    keywords?: string,
    sortBy?: string,
    orderBy?: Order,
  ): Promise<[Project[], number]> {
    const sortColumn = (sortBy && SORTABLE_COLUMNS[sortBy]) ?? DEFAULT_SORT_COLUMN;
    const sortDirection = orderBy ?? Order.DESC;

    const qb = this.createQueryBuilder('project')
      .where('project.business_id = :businessId', { businessId })
      .orderBy(sortColumn, sortDirection)
      .skip(skip)
      .take(take);

    if (keywords) {
      qb.andWhere('project.title ILIKE :keywords', { keywords: `%${keywords}%` });
    }

    return qb.getManyAndCount();
  }

  public async findByIdAndBusinessId(id: string, businessId: string): Promise<Project | null> {
    return this.findOne({ where: { id, businessId } });
  }

  // Returns public projects where at least one required skill is in the given set.
  // Uses a subquery (IN) instead of JOIN to avoid duplicate rows when multiple
  // required skills match the consultant's skill list.
  public async findPublicMatchingSkills(
    skillIds: string[],
    skip: number,
    take: number,
  ): Promise<[Project[], number]> {
    if (skillIds.length === 0) return [[], 0];

    const qb = this.createQueryBuilder('project')
      .where('project.status = :status', { status: ProjectStatus.PUBLIC })
      .andWhere((subQb) => {
        const sub = subQb
          .subQuery()
          .select('prs.project_id')
          .from('project_required_skills', 'prs')
          .where('prs.skill_id IN (:...skillIds)', { skillIds })
          .getQuery();
        return `project.id IN ${sub}`;
      })
      .orderBy('project.published_at', 'DESC')
      .skip(skip)
      .take(take);

    return qb.getManyAndCount();
  }
}
