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
   * Returns the project row under a `SELECT ... FOR UPDATE` pessimistic
   * write lock. MUST be called inside an active transaction — TypeORM raises
   * "Lock mode requires query runner" otherwise. Used by the apply flow to
   * serialize concurrent join attempts so capacity (`active_member_count <
   * required_consultants`) cannot be exceeded by a race. Returns `null`
   * when the project is missing or soft-deleted.
   */
  findByIdForUpdate(projectId: string): Promise<Project | null>;

  /**
   * Returns the discovery-feed list for an authenticated consultant. Status
   * is hard-pinned to PUBLISHED + IN_PROGRESS regardless of caller input —
   * other statuses can never be surfaced. When `status` is provided it must
   * be one of those two values; the method then narrows to that single
   * status. Optional case-insensitive title substring. Sort order:
   * `business.is_partner_platform DESC` (so partner-platform projects
   * surface first), then `project.published_at DESC NULLS LAST`, then
   * `project.id ASC` for a stable cross-page tiebreak. Returned `Project`
   * rows have `business` eagerly populated, so callers can read
   * `project.business.companyName` / `isPartnerPlatform` without a second
   * round-trip.
   *
   * @param params.titleSearch - Optional case-insensitive substring match on `project.title`.
   * @param params.status - Optional single-status narrow; falls back to both PUBLISHED + IN_PROGRESS.
   * @param params.skip - Pagination offset (0-based).
   * @param params.take - Page size.
   * @returns A `[rows, totalCount]` tuple — total ignores skip/take.
   */
  findDiscoverableForConsultant(params: {
    titleSearch?: string;
    status?: ProjectStatus.PUBLISHED | ProjectStatus.IN_PROGRESS;
    skip: number;
    take: number;
  }): Promise<[Project[], number]>;

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

  /**
   * Returns active (PUBLISHED + IN_PROGRESS by default) projects for a
   * business, optionally narrowed to a single status. Sorted by `published_at`
   * DESC, then `id` ASC for stability. Used by the business-dashboard
   * project-health table.
   * @param businessId Owner.
   * @param limit Max rows; the caller caps the upper bound on validation.
   * @param statuses Status whitelist; defaults to PUBLISHED + IN_PROGRESS.
   */
  findActiveByBusinessId(
    businessId: string,
    limit: number,
    statuses?: ProjectStatus[],
  ): Promise<Project[]>;

  /**
   * Returns the public explore-page list. PUBLISHED + IN_PROGRESS projects
   * only — the status filter is hard-pinned by this method regardless of
   * caller input, so DRAFT / CANCELLED / DONE projects can never be
   * surfaced. When `status` is provided it must be one of those two values;
   * the method narrows the filter to that single status. Optional
   * case-insensitive title substring and/or a set of required-skill ids
   * (ANY-match — i.e. the project requires at least one of `skillIds`).
   * Sorted by `business.is_partner_platform DESC` so partner-platform
   * projects bubble to the top, then by `project.published_at DESC`, then
   * by `project.id ASC` for stability. The returned `Project[]` rows have
   * `business` eagerly populated.
   */
  findExploreList(params: {
    skillIds?: string[];
    titleSearch?: string;
    status?: ProjectStatus.PUBLISHED | ProjectStatus.IN_PROGRESS;
    skip: number;
    take: number;
  }): Promise<[Project[], number]>;

  /**
   * Returns a single PUBLISHED or IN_PROGRESS project for the public detail
   * endpoint, with `business` eagerly populated. Returns null when the id
   * does not exist, is soft-deleted, or has a non-accessible status.
   */
  findExploreDetail(id: string): Promise<Project | null>;

  /**
   * Paginated list of projects where the given consultant has an ACTIVE
   * membership. Eagerly loads `business` so callers can read
   * `companyName` without a second round-trip. Optional case-insensitive
   * substring keyword matched against `title` OR `code`. Sorted by
   * `pm.joined_at DESC` then `project.id ASC` for cross-page stability.
   *
   * @returns `[rows, totalCount]` — total ignores skip/take.
   */
  findJoinedByConsultantPaginated(params: {
    consultantId: string;
    keyword?: string;
    skip: number;
    take: number;
  }): Promise<[Project[], number]>;

  /**
   * Lightweight variant of {@link findJoinedByConsultantPaginated} used by
   * the workspace switcher. Projects only (no business join), selects only
   * `id, code, title, status`. Sorted alphabetically by `title ASC, id ASC`
   * — switcher-friendly UX.
   */
  findJoinedByConsultantLightweight(params: {
    consultantId: string;
    keyword?: string;
    skip: number;
    take: number;
  }): Promise<[Project[], number]>;
}
