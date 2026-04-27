import { Order } from '@common/dto/page-options.dto';
import { AbstractRepository } from '@common/repositories';
import { Project } from '@database/entities';
import { ProjectStatus } from '@database/enums';

export type ProjectTrendGrouping = 'weekly' | 'monthly';

export interface IProjectTrendPoint {
  period_label: string;
  created_count: number;
  published_count: number;
}

export interface IProjectRepository extends AbstractRepository<Project> {
  findByBusinessId(
    businessId: string,
    skip: number,
    take: number,
    keywords?: string,
    sortBy?: string,
    orderBy?: Order,
  ): Promise<[Project[], number]>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<Project | null>;
  findPublicMatchingSkills(
    skillIds: string[],
    skip: number,
    take: number,
  ): Promise<[Project[], number]>;
  findPublicById(id: string): Promise<Project | null>;

  /** Returns project IDs owned by a business. Excludes soft-deleted rows. */
  findIdsByBusinessId(businessId: string): Promise<string[]>;

  /** Returns id+title pairs for a business — used by stats endpoints that need names. */
  findIdsAndTitlesByBusinessId(businessId: string): Promise<Array<{ id: string; title: string }>>;

  /**
   * Counts projects grouped by `status` for a single business. Statuses with
   * zero matches are still present (zero-filled). Optional ISO `from`/`to`
   * filter the `created_at` column.
   */
  countByBusinessIdGroupedByStatus(
    businessId: string,
    from?: string,
    to?: string,
  ): Promise<Record<ProjectStatus, number>>;

  /**
   * Returns a time-series of project creation counts (and publish counts within
   * the same period) grouped by ISO week or calendar month. Sorted ascending
   * by `period_label`.
   */
  countCreatedByBusinessIdGroupedByPeriod(
    businessId: string,
    period: ProjectTrendGrouping,
    from?: string,
    to?: string,
  ): Promise<IProjectTrendPoint[]>;
}
