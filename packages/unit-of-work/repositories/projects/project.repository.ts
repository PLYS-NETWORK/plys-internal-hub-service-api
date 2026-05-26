import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { Project } from '@plys/libraries/database/entities';
import {
  PROJECT_STATUSES,
  ProjectMemberStatus,
  ProjectStatus,
} from '@plys/libraries/database/enums';
import { EntityManager } from 'typeorm';

import { IProjectRepository, IProjectTrendPoint, ProjectTrendGrouping } from './interfaces';

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

  public async findByIdAndBusinessId(id: string, businessId: string): Promise<Project | null> {
    return this.findOne({ where: { id, businessId } });
  }

  /** @inheritdoc */
  public async findByIdForUpdate(projectId: string): Promise<Project | null> {
    return this.createQueryBuilder('project')
      .setLock('pessimistic_write')
      .where('project.id = :projectId', { projectId })
      .andWhere('project.deleted_at IS NULL')
      .getOne();
  }

  /** @inheritdoc */
  public async findDiscoverableForConsultant(params: {
    titleSearch?: string;
    status?: ProjectStatus.PUBLISHED | ProjectStatus.IN_PROGRESS;
    skip: number;
    take: number;
  }): Promise<[Project[], number]> {
    // Hard-pinned status allow-list. Narrowing to a single value is allowed
    // (and validated by the DTO), but DRAFT / CONFIGURED / DONE / CANCELLED
    // can never leak through even if the caller crafts a request.
    const allowedStatuses: ProjectStatus[] = [ProjectStatus.PUBLISHED, ProjectStatus.IN_PROGRESS];
    const statuses: ProjectStatus[] =
      params.status && allowedStatuses.includes(params.status) ? [params.status] : allowedStatuses;

    const qb = this.createQueryBuilder('project')
      .innerJoinAndSelect('project.business', 'business')
      .where('project.deleted_at IS NULL')
      .andWhere('project.status IN (:...statuses)', { statuses });

    const trimmedTitle = params.titleSearch?.trim();
    if (trimmedTitle && trimmedTitle.length > 0) {
      qb.andWhere('LOWER(project.title) LIKE :title', {
        title: `%${trimmedTitle.toLowerCase()}%`,
      });
    }

    // Partner-platform projects bubble to the top (TRUE > FALSE under DESC),
    // then most-recently-published, then id for a stable tiebreak across pages.
    // NOTE: orderBy with skip/take + JOIN routes through TypeORM's distinct-id
    // subquery, which resolves "alias.property" via findColumnWithPropertyPath —
    // so the property segment MUST be the entity property name (camelCase),
    // never the DB column name. Using snake_case here throws
    // "Cannot read properties of undefined (reading 'databaseName')".
    qb.orderBy('business.isPartnerPlatform', 'DESC')
      .addOrderBy('project.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('project.id', 'ASC')
      .skip(params.skip)
      .take(params.take);

    return qb.getManyAndCount();
  }

  /** @inheritdoc */
  public async findExploreList(params: {
    skillIds?: string[];
    titleSearch?: string;
    status?: ProjectStatus.PUBLISHED | ProjectStatus.IN_PROGRESS;
    skip: number;
    take: number;
  }): Promise<[Project[], number]> {
    // Allow-list pinned here so the public endpoint cannot surface
    // DRAFT / CANCELLED / DONE projects even if the caller crafts a request.
    const allowedStatuses: ProjectStatus[] = [ProjectStatus.PUBLISHED, ProjectStatus.IN_PROGRESS];
    const statuses: ProjectStatus[] =
      params.status && allowedStatuses.includes(params.status) ? [params.status] : allowedStatuses;

    const qb = this.createQueryBuilder('project')
      .innerJoinAndSelect('project.business', 'business')
      .where('project.deleted_at IS NULL')
      .andWhere('project.status IN (:...statuses)', { statuses });

    const trimmedTitle = params.titleSearch?.trim();
    if (trimmedTitle && trimmedTitle.length > 0) {
      qb.andWhere('LOWER(project.title) LIKE :title', {
        title: `%${trimmedTitle.toLowerCase()}%`,
      });
    }

    if (params.skillIds && params.skillIds.length > 0) {
      qb.andWhere((subQb) => {
        const sub = subQb
          .subQuery()
          .select('prs.project_id')
          .from('project_required_skills', 'prs')
          .where('prs.skill_id IN (:...skillIds)', { skillIds: params.skillIds })
          .getQuery();
        return `project.id IN ${sub}`;
      });
    }

    // Partner-platform projects sort first (TRUE > FALSE in Postgres DESC),
    // then most-recently-published, then id for a stable tiebreak.
    // See findDiscoverableForConsultant for why these must be camelCase
    // property names rather than snake_case column names.
    qb.orderBy('business.isPartnerPlatform', 'DESC')
      .addOrderBy('project.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('project.id', 'ASC')
      .skip(params.skip)
      .take(params.take);

    return qb.getManyAndCount();
  }

  /** @inheritdoc */
  public async findExploreDetail(id: string): Promise<Project | null> {
    return this.createQueryBuilder('project')
      .innerJoinAndSelect('project.business', 'business')
      .where('project.id = :id', { id })
      .andWhere('project.deleted_at IS NULL')
      .andWhere('project.status IN (:...statuses)', {
        statuses: [ProjectStatus.PUBLISHED, ProjectStatus.IN_PROGRESS],
      })
      .getOne();
  }

  /** @inheritdoc */
  public async findAccessibleByIdForConsultant(
    id: string,
    consultantId: string,
    statuses: ProjectStatus[],
  ): Promise<Project | null> {
    if (statuses.length === 0) return null;
    return this.createQueryBuilder('project')
      .where('project.id = :id', { id })
      .andWhere('project.deleted_at IS NULL')
      .andWhere(
        `(project.status IN (:...statuses)
          OR EXISTS (
            SELECT 1 FROM project_members pm
             WHERE pm.project_id = project.id
               AND pm.consultant_id = :consultantId
               AND pm.status = 'active'
          ))`,
        { statuses, consultantId },
      )
      .getOne();
  }

  public async findIdsByBusinessId(businessId: string): Promise<string[]> {
    const rows = await this.createQueryBuilder('project')
      .select('project.id', 'id')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL')
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
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

  /** @inheritdoc */
  public async findActiveByBusinessId(
    businessId: string,
    limit: number,
    statuses: ProjectStatus[] = [ProjectStatus.PUBLISHED, ProjectStatus.IN_PROGRESS],
  ): Promise<Project[]> {
    if (statuses.length === 0) return [];
    return this.createQueryBuilder('project')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL')
      .andWhere('project.status IN (:...statuses)', { statuses })
      .orderBy('project.published_at', 'DESC', 'NULLS LAST')
      .addOrderBy('project.id', 'ASC')
      .take(limit)
      .getMany();
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
        `COUNT(*) FILTER (WHERE project.status IN ('draft', 'configured'))`,
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

  /** @inheritdoc */
  public async findJoinedByConsultantPaginated(params: {
    consultantId: string;
    keyword?: string;
    skip: number;
    take: number;
  }): Promise<[Project[], number]> {
    const { consultantId, keyword, skip, take } = params;

    const qb = this.createQueryBuilder('project')
      .innerJoin(
        'project_members',
        'pm',
        'pm.project_id = project.id AND pm.consultant_id = :consultantId AND pm.status = :memberStatus',
        { consultantId, memberStatus: ProjectMemberStatus.ACTIVE },
      )
      .leftJoinAndSelect('project.business', 'business')
      .where('project.deleted_at IS NULL');

    const trimmed = keyword?.trim();
    if (trimmed && trimmed.length > 0) {
      const like = `%${trimmed.toLowerCase()}%`;
      qb.andWhere('(LOWER(project.title) LIKE :kw OR LOWER(project.code) LIKE :kw)', { kw: like });
    }

    qb.orderBy('pm.joined_at', 'DESC').addOrderBy('project.id', 'ASC').skip(skip).take(take);

    return qb.getManyAndCount();
  }

  /** @inheritdoc */
  public async findJoinedByConsultantLightweight(params: {
    consultantId: string;
  }): Promise<Project[]> {
    const { consultantId } = params;

    return (
      this.createQueryBuilder('project')
        .select(['project.id', 'project.code', 'project.title', 'project.status'])
        .innerJoin(
          'project_members',
          'pm',
          'pm.project_id = project.id AND pm.consultant_id = :consultantId AND pm.status = :memberStatus',
          { consultantId, memberStatus: ProjectMemberStatus.ACTIVE },
        )
        .where('project.deleted_at IS NULL')
        // IN_PROGRESS projects float to the top — they're the consultant's
        // active workload. Remaining statuses fall back to alphabetical so the
        // switcher stays scannable; id is the final tiebreak for stability.
        .orderBy(`CASE WHEN project.status = :inProgress THEN 0 ELSE 1 END`, 'ASC')
        .addOrderBy('project.title', 'ASC')
        .addOrderBy('project.id', 'ASC')
        .setParameter('inProgress', ProjectStatus.IN_PROGRESS)
        .getMany()
    );
  }
}
