import { AbstractRepository } from '@common/repositories';
import { ProjectMember } from '@database/entities';

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
}
