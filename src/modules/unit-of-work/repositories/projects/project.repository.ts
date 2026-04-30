import { Order } from '@common/dto/page-options.dto';
import { AbstractRepository } from '@common/repositories';
import { Project } from '@database/entities';
import { PROJECT_STATUSES, ProjectStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IProjectRepository, IProjectTrendPoint, ProjectTrendGrouping } from './interfaces';

// Columns the caller is allowed to sort by. Any unrecognised value falls back
// to the default (created_at) to prevent SQL injection via the sort_by param.
const SORTABLE_COLUMNS: Record<string, string> = {
  title: 'project.title',
  status: 'project.status',
  required_consultants: 'project.requiredConsultants',
  created_at: 'project.createdAt',
};
const DEFAULT_SORT_COLUMN = 'project.createdAt';

// Escapes the LIKE wildcards a caller might inject via free-text search.
// Without this, a query of "%" or "_" would force a full-table scan and
// match unintended rows.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

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
      .andWhere('project.deleted_at IS NULL')
      .orderBy(sortColumn, sortDirection)
      // Tiebreaker so pages remain stable when multiple rows share the
      // primary sort value (offset pagination would otherwise skip/duplicate).
      .addOrderBy('project.id', 'ASC')
      .skip(skip)
      .take(take);

    if (keywords) {
      qb.andWhere('project.title ILIKE :keywords ESCAPE :esc', {
        keywords: `%${escapeLikePattern(keywords)}%`,
        esc: '\\',
      });
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
      .where('project.status = :status', { status: ProjectStatus.PUBLISHED })
      // createQueryBuilder does not auto-filter soft-deleted rows; without this
      // a soft-deleted-but-still-PUBLIC project would leak into discovery.
      .andWhere('project.deleted_at IS NULL')
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
      .addOrderBy('project.id', 'ASC')
      .skip(skip)
      .take(take);

    return qb.getManyAndCount();
  }

  public async findPublicById(id: string): Promise<Project | null> {
    return this.findOne({ where: { id, status: ProjectStatus.PUBLISHED } });
  }

  public async findIdsByBusinessId(businessId: string): Promise<string[]> {
    const rows = await this.createQueryBuilder('project')
      .select('project.id', 'id')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL')
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  public async findIdsAndTitlesByBusinessId(
    businessId: string,
  ): Promise<Array<{ id: string; title: string }>> {
    return this.createQueryBuilder('project')
      .select('project.id', 'id')
      .addSelect('project.title', 'title')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL')
      .getRawMany<{ id: string; title: string }>();
  }

  // Returns counts keyed by every value of `ProjectStatus`. Statuses with zero
  // matches are still present (zero-filled) so callers do not need to merge maps.
  public async countByBusinessIdGroupedByStatus(
    businessId: string,
    from?: string,
    to?: string,
  ): Promise<Record<ProjectStatus, number>> {
    const qb = this.createQueryBuilder('project')
      .select('project.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL');

    if (from) qb.andWhere('project.created_at >= :from', { from });
    if (to) qb.andWhere('project.created_at <= :to', { to });

    const rows = await qb
      .groupBy('project.status')
      .getRawMany<{ status: ProjectStatus; count: string }>();

    const out = {} as Record<ProjectStatus, number>;
    for (const status of PROJECT_STATUSES) out[status] = 0;
    for (const row of rows) out[row.status] = Number(row.count);
    return out;
  }

  // Time-series of created/published counts grouped by week or month.
  // Uses `to_char(date_trunc(...))` so Postgres formats the period_label without
  // round-tripping JS Date objects.
  public async countCreatedByBusinessIdGroupedByPeriod(
    businessId: string,
    period: ProjectTrendGrouping,
    from?: string,
    to?: string,
  ): Promise<IProjectTrendPoint[]> {
    const truncUnit = period === 'weekly' ? 'week' : 'month';
    const labelFormat = period === 'weekly' ? 'IYYY-"W"IW' : 'YYYY-MM';

    const qb = this.createQueryBuilder('project')
      .select(
        `to_char(date_trunc('${truncUnit}', project.created_at), '${labelFormat}')`,
        'period_label',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE project.status IN ('draft', 'setting_up', 'configured'))`,
        'created_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE project.status IN ('published', 'in_progress', 'done'))`,
        'published_count',
      )
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL');

    if (from) qb.andWhere('project.created_at >= :from', { from });
    if (to) qb.andWhere('project.created_at <= :to', { to });

    const rows = await qb
      .groupBy('period_label')
      .orderBy('period_label', 'ASC')
      .getRawMany<{ period_label: string; created_count: string; published_count: string }>();

    return rows.map((row) => ({
      period_label: row.period_label,
      created_count: Number(row.created_count),
      published_count: Number(row.published_count),
    }));
  }
}
