import { AbstractRepository } from '@common/repositories';
import { ProjectMember } from '@database/entities';

/** Consultant snapshot returned by team-performance roster lookups. */
export interface IBusinessTeamConsultantRow {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
  /** Count of distinct ACTIVE memberships across the owner's projects. */
  active_projects_count: number;
}

export interface IProjectMemberRepository extends AbstractRepository<ProjectMember> {
  /**
   * Returns active-member counts grouped by `projectId` in a single round-trip.
   * Projects with no active members are absent from the map (callers should
   * fall back to `0`).
   *
   * @param projectIds - Project UUIDs to aggregate over.
   * @returns Map of `projectId → number of ACTIVE members`.
   */
  countActiveByProjectIds(projectIds: string[]): Promise<Map<string, number>>;

  /**
   * Returns the **summed** active-member count across the given projects in a
   * single query.
   */
  countActiveTotalByProjectIds(projectIds: string[]): Promise<number>;

  /**
   * Distinct-consultant count for ACTIVE memberships across the given
   * projects. Used by the business-dashboard `team.active_consultants` KPI.
   * Returns `0` when no projects are supplied.
   */
  countDistinctActiveConsultantsByProjectIds(projectIds: string[]): Promise<number>;

  /**
   * Distinct-consultant count whose `joined_at` falls in the window —
   * "new consultants this period" KPI.
   */
  countDistinctNewConsultantsByProjectIdsBetween(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<number>;

  /**
   * Top-N consultants for the team-performance roster table, joining
   * `consultant_profiles` so the row carries `full_name` + `avatar_url`.
   * Filtered to ACTIVE memberships across the given projects. Returns
   * `active_projects_count` per consultant. Returns rows sorted by
   * `full_name` ASC — service decides the metric sort order post-aggregation.
   */
  findActiveConsultantsByProjectIds(
    projectIds: string[],
    limit: number,
  ): Promise<IBusinessTeamConsultantRow[]>;
}
