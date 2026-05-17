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
   * Returns the single (or null) membership row for a project + consultant
   * pair regardless of status. The `uq_project_members_project_consultant`
   * unique constraint guarantees at most one row exists. Used by the apply
   * flow to detect existing LEFT / REMOVED rows and by leave to load the
   * active row.
   */
  findByProjectAndConsultant(
    projectId: string,
    consultantId: string,
  ): Promise<ProjectMember | null>;

  /**
   * Flips an existing membership row to ACTIVE. Sets `joined_at = NOW()`,
   * clears `left_at`. Use ONLY when the row is currently LEFT — REMOVED is
   * a ban-like state and should not be reactivated.
   */
  activate(member: ProjectMember): Promise<ProjectMember>;

  /**
   * Flips an ACTIVE membership row to LEFT and records `left_at = NOW()`.
   */
  markLeft(member: ProjectMember): Promise<ProjectMember>;

  /**
   * Returns the subset of `projectIds` for which the given consultant has
   * an ACTIVE membership row. Powers per-row `is_joined` flags in the
   * consultant discovery feed (list) and the detail view (single id). Runs
   * as one query and returns a `Set` for O(1) lookup during DTO mapping.
   *
   * @param consultantId - Caller's consultant profile id.
   * @param projectIds - Project UUIDs to check against. Empty array short-circuits to an empty set.
   * @returns Set of project IDs where the consultant is currently ACTIVE.
   */
  findActiveProjectIdsByConsultantId(
    consultantId: string,
    projectIds: string[],
  ): Promise<Set<string>>;

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
