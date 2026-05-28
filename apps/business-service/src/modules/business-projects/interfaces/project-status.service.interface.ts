import { ProjectStatus } from '@plys/libraries/database/enums';
import { IUnitOfWork } from '@plys/libraries/unit-of-work/interfaces/unit-of-work.interface';

/**
 * Centralised project-status auto-transition rules. Both setup-phase
 * recompute and the PUBLISHED→IN_PROGRESS promotion live here so the same
 * logic is not duplicated across `BacklogsService`, `SettingsService`, and
 * the two `BoardService`s on either side of the marketplace.
 *
 * All methods participate in a caller-supplied transaction — the surrounding
 * service is responsible for opening / committing / rolling it back.
 */
export interface IProjectStatusService {
  /**
   * Recomputes the auto-derived status of a setup-phase project from its
   * completeness signals (draft tasks, required skills, required consultants).
   *
   * Rules — applied bidirectionally:
   *   - drafts == 0 OR skills == 0 OR consultants == 0         → DRAFT
   *   - drafts > 0 AND skills > 0 AND consultants > 0          → CONFIGURED
   *
   * Silently no-ops when the project has been published (`publishedAt IS NOT
   * NULL`) or when its status is not in `{DRAFT, CONFIGURED}` — those are
   * downstream states that this helper must never touch (so e.g. republishing
   * a project does not demote it back to DRAFT just because the draft-task
   * count is zero post-payTasks).
   *
   * @param tx Active unit of work. Caller controls the surrounding transaction.
   * @param projectId Project to recompute.
   * @returns The status the project ended up in (whether changed or not).
   */
  recomputeAutoStatus(tx: IUnitOfWork, projectId: string): Promise<ProjectStatus>;

  /**
   * Promotes a project from PUBLISHED → IN_PROGRESS. Intended to be called
   * after a task is assigned (consultant claim or business assign). No-ops for
   * any other status, so it is safe to call unconditionally from the assign
   * paths without re-checking the project status outside.
   *
   * The caller must already hold the relevant rows under the same transaction
   * so the read-then-write is race-free.
   *
   * @param tx Active unit of work.
   * @param projectId Project whose status should be evaluated.
   * @returns The status the project ended up in.
   */
  promoteToInProgressIfPublished(tx: IUnitOfWork, projectId: string): Promise<ProjectStatus>;
}
