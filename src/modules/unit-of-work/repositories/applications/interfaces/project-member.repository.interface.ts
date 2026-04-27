import { AbstractRepository } from '@common/repositories';
import { ProjectMember } from '@database/entities';

export interface IActiveMemberRow {
  user_id: string;
  full_name: string;
  joined_at: Date;
  /** From `User.lastLoginAt` — `null` for users who never logged in. */
  last_login_at: Date | null;
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
   * single query — used for the funnel-stage `active` count.
   */
  countActiveTotalByProjectIds(projectIds: string[]): Promise<number>;

  /**
   * Returns the active member roster of a single project with the consultant's
   * display name and the underlying `User.lastLoginAt` joined in. Powers the
   * project-overview members card (`last_active_at`).
   */
  findActiveByProjectIdWithUser(projectId: string): Promise<IActiveMemberRow[]>;
}
