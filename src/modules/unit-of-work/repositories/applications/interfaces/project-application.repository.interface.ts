import { AbstractRepository } from '@common/repositories';
import { ProjectApplication } from '@database/entities';

export interface IProjectApplicationRepository extends AbstractRepository<ProjectApplication> {
  /**
   * Returns application counts grouped by `projectId` in a single round-trip.
   * Counts every status (pending, accepted, rejected, withdrawn). Projects with
   * no applications are absent from the map (callers should fall back to `0`).
   *
   * @param projectIds - Project UUIDs to aggregate over.
   * @returns Map of `projectId → total application count`.
   */
  countByProjectIds(projectIds: string[]): Promise<Map<string, number>>;
}
