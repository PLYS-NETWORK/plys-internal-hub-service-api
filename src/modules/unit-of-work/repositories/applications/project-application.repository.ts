import { AbstractRepository } from '@common/repositories';
import { ProjectApplication } from '@database/entities';
import { ApplicationStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, SelectQueryBuilder } from 'typeorm';

import {
  IApplicationFunnelCounts,
  IApplicationsPerProjectRow,
  IPendingApplicationRow,
  IProjectApplicationRepository,
} from './interfaces';

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
  public async countFunnelByProjectIds(
    projectIds: string[],
    from?: string,
    to?: string,
    projectIdFilter?: string,
  ): Promise<IApplicationFunnelCounts> {
    if (projectIds.length === 0) return { applied: 0, reviewed: 0, approved: 0 };

    const qb = this.createQueryBuilder('pa')
      .select('COUNT(*)', 'applied')
      .addSelect('COUNT(*) FILTER (WHERE pa.reviewed_at IS NOT NULL)', 'reviewed')
      .addSelect(`COUNT(*) FILTER (WHERE pa.status = '${ApplicationStatus.ACCEPTED}')`, 'approved')
      .where('pa.project_id IN (:...projectIds)', { projectIds });

    this.applyDateRange(qb, from, to);
    this.applyProjectIdFilter(qb, projectIdFilter);

    const row = await qb.getRawOne<{ applied: string; reviewed: string; approved: string }>();
    return {
      applied: Number(row?.applied ?? 0),
      reviewed: Number(row?.reviewed ?? 0),
      approved: Number(row?.approved ?? 0),
    };
  }

  /** @inheritdoc */
  public async countByProjectIdsGroupedByProjectAndStatus(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<IApplicationsPerProjectRow[]> {
    if (projectIds.length === 0) return [];

    const qb = this.createQueryBuilder('pa')
      .innerJoin('pa.project', 'project')
      .select('project.id', 'project_id')
      .addSelect('project.title', 'project_name')
      .addSelect('COUNT(*)', 'total_applications')
      .addSelect(
        `COUNT(*) FILTER (WHERE pa.status = '${ApplicationStatus.PENDING}')`,
        'pending_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE pa.status = '${ApplicationStatus.ACCEPTED}')`,
        'approved_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE pa.status = '${ApplicationStatus.REJECTED}')`,
        'rejected_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE pa.status = '${ApplicationStatus.WITHDRAWN}')`,
        'withdrawn_count',
      )
      .where('pa.project_id IN (:...projectIds)', { projectIds });

    this.applyProjectIdFilter(qb, projectIdFilter);

    const rows = await qb
      .groupBy('project.id')
      .addGroupBy('project.title')
      .orderBy('total_applications', 'DESC')
      .getRawMany<{
        project_id: string;
        project_name: string;
        total_applications: string;
        pending_count: string;
        approved_count: string;
        rejected_count: string;
        withdrawn_count: string;
      }>();

    return rows.map((r) => ({
      project_id: r.project_id,
      project_name: r.project_name,
      total_applications: Number(r.total_applications),
      pending_count: Number(r.pending_count),
      approved_count: Number(r.approved_count),
      rejected_count: Number(r.rejected_count),
      withdrawn_count: Number(r.withdrawn_count),
    }));
  }

  /** @inheritdoc */
  public async countByProjectIdAndStatus(
    projectId: string,
    status: ApplicationStatus,
  ): Promise<number> {
    const row = await this.createQueryBuilder('pa')
      .select('COUNT(*)', 'count')
      .where('pa.project_id = :projectId', { projectId })
      .andWhere('pa.status = :status', { status })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async countPendingByProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('pa')
      .select('COUNT(*)', 'count')
      .where('pa.project_id IN (:...projectIds)', { projectIds })
      .andWhere(`pa.status = '${ApplicationStatus.PENDING}'`)
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async findPendingByProjectIds(
    projectIds: string[],
    skip: number,
    take: number,
  ): Promise<[IPendingApplicationRow[], number]> {
    if (projectIds.length === 0) return [[], 0];

    const baseQb = this.createQueryBuilder('pa')
      .innerJoin('pa.project', 'project')
      .innerJoin('pa.consultant', 'consultant')
      .where('pa.project_id IN (:...projectIds)', { projectIds })
      .andWhere(`pa.status = '${ApplicationStatus.PENDING}'`);

    const totalRow = await baseQb
      .clone()
      .select('COUNT(*)', 'count')
      .getRawOne<{ count: string }>();
    const total = Number(totalRow?.count ?? 0);

    if (total === 0) return [[], 0];

    const rows = await baseQb
      .clone()
      .select('pa.id', 'application_id')
      .addSelect('pa.project_id', 'project_id')
      .addSelect('project.title', 'project_name')
      .addSelect('pa.consultant_id', 'consultant_id')
      .addSelect('consultant.full_name', 'consultant_name')
      .addSelect('pa.applied_at', 'applied_at')
      .addSelect(
        `(
          SELECT COUNT(*)
          FROM project_interview_questions q
          WHERE q.project_id = pa.project_id AND q.is_required = true
        )`,
        'required_questions',
      )
      .addSelect(
        `(
          SELECT COUNT(DISTINCT ia.question_id)
          FROM interview_answers ia
          INNER JOIN project_interview_questions q ON q.id = ia.question_id
          WHERE ia.application_id = pa.id AND q.is_required = true
        )`,
        'answered_questions',
      )
      .orderBy('pa.applied_at', 'ASC')
      .addOrderBy('pa.id', 'ASC')
      .offset(skip)
      .limit(take)
      .getRawMany<{
        application_id: string;
        project_id: string;
        project_name: string;
        consultant_id: string;
        consultant_name: string;
        applied_at: Date;
        required_questions: string;
        answered_questions: string;
      }>();

    const items: IPendingApplicationRow[] = rows.map((r) => {
      const required = Number(r.required_questions);
      const answered = Number(r.answered_questions);
      return {
        application_id: r.application_id,
        project_id: r.project_id,
        project_name: r.project_name,
        consultant_id: r.consultant_id,
        consultant_name: r.consultant_name,
        applied_at: r.applied_at,
        // No required questions ⇒ vacuously "answered". Otherwise needs full coverage.
        has_answered_questions: required === 0 ? true : answered >= required,
      };
    });

    return [items, total];
  }

  /** @inheritdoc */
  public async existsActiveByConsultantAndProject(
    consultantId: string,
    projectId: string,
  ): Promise<boolean> {
    const row = await this.createQueryBuilder('pa')
      .select('1', 'present')
      .where('pa.consultant_id = :consultantId', { consultantId })
      .andWhere('pa.project_id = :projectId', { projectId })
      .andWhere('pa.status IN (:...statuses)', {
        statuses: [ApplicationStatus.PENDING, ApplicationStatus.ACCEPTED],
      })
      .limit(1)
      .getRawOne<{ present: number }>();
    return row !== undefined;
  }

  /** @inheritdoc */
  public async findActiveProjectIdsByConsultantAndProjects(
    consultantId: string,
    projectIds: string[],
  ): Promise<Set<string>> {
    if (projectIds.length === 0) return new Set();
    const rows = await this.createQueryBuilder('pa')
      .select('DISTINCT pa.project_id', 'project_id')
      .where('pa.consultant_id = :consultantId', { consultantId })
      .andWhere('pa.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pa.status IN (:...statuses)', {
        statuses: [ApplicationStatus.PENDING, ApplicationStatus.ACCEPTED],
      })
      .getRawMany<{ project_id: string }>();
    return new Set(rows.map((r) => r.project_id));
  }

  private applyDateRange(
    qb: SelectQueryBuilder<ProjectApplication>,
    from?: string,
    to?: string,
  ): void {
    if (from) qb.andWhere('pa.applied_at >= :from', { from });
    if (to) qb.andWhere('pa.applied_at <= :to', { to });
  }

  private applyProjectIdFilter(
    qb: SelectQueryBuilder<ProjectApplication>,
    projectIdFilter?: string,
  ): void {
    if (projectIdFilter) {
      qb.andWhere('pa.project_id = :projectIdFilter', { projectIdFilter });
    }
  }
}
