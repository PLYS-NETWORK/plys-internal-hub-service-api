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
  findByIdAndBusinessId(id: string, businessId: string): Promise<Project | null>;

  /**
   * Returns projects whose `status` is one of `statuses` and that require at
   * least one of the supplied skill ids. Used by the consultant discovery
   * feed; PUBLISHED + IN_PROGRESS are both surfaced because in-progress
   * projects can still recruit additional members.
   */
  findAccessibleMatchingSkills(
    skillIds: string[],
    statuses: ProjectStatus[],
    skip: number,
    take: number,
  ): Promise<[Project[], number]>;

  /**
   * Returns a project that is either in one of the accessible `statuses` or
   * has the given consultant as an ACTIVE member. Used by the consultant
   * project detail endpoint.
   */
  findAccessibleByIdForConsultant(
    id: string,
    consultantId: string,
    statuses: ProjectStatus[],
  ): Promise<Project | null>;

  /** Returns project IDs owned by a business. Excludes soft-deleted rows. */
  findIdsByBusinessId(businessId: string): Promise<string[]>;

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
