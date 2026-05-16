import { ConsultantMembershipResponseDto } from '../dto/responses';

export interface IConsultantMembershipService {
  /**
   * Apply to (join) a discoverable project as the calling consultant.
   *
   * Validation order (each step surfaces a specific error code):
   *   1. Project exists and is not soft-deleted; status ∈ {PUBLISHED, IN_PROGRESS}.
   *   2. No existing ACTIVE membership for the caller → PROJECT_ALREADY_MEMBER.
   *   3. No existing REMOVED row (admin/business kicked them out) → PROJECT_MEMBERSHIP_BANNED.
   *   4. Required-skill match ≥ 50% (vacuously true when the project has 0
   *      required skills) → otherwise PROJECT_SKILL_MATCH_INSUFFICIENT.
   *   5. Caller currently has fewer than MAX_CONCURRENT_PROJECTS active
   *      memberships → otherwise PROJECT_CONCURRENT_LIMIT_REACHED. The DB
   *      trigger `trg_enforce_consultant_project_limit` also enforces this
   *      server-side; the application-layer pre-check supplies a friendly
   *      error code.
   *   6. Inside a transaction with `SELECT ... FOR UPDATE` on the project row,
   *      active member count < requiredConsultants → otherwise PROJECT_FULL.
   *   7. Insert (no row) or reactivate (status = LEFT) within the same tx.
   *
   * After commit, the caller's `consultant_explore` list + detail caches are
   * invalidated so the next read returns the updated `is_joined` flag.
   *
   * @param projectId - UUID of the project to apply to.
   * @returns The freshly-active membership snapshot.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 409 PROJECT_NOT_JOINABLE.
   * @throws TranslatableException 409 PROJECT_ALREADY_MEMBER.
   * @throws TranslatableException 403 PROJECT_MEMBERSHIP_BANNED.
   * @throws TranslatableException 422 PROJECT_SKILL_MATCH_INSUFFICIENT.
   * @throws TranslatableException 409 PROJECT_CONCURRENT_LIMIT_REACHED.
   * @throws TranslatableException 409 PROJECT_FULL.
   */
  apply(projectId: string): Promise<ConsultantMembershipResponseDto>;

  /**
   * Leave a project the calling consultant is currently ACTIVE on.
   *
   * Validation order:
   *   1. Project exists.
   *   2. Caller has an ACTIVE membership row → otherwise PROJECT_NOT_MEMBER.
   *   3. No tasks assigned to the caller on this project whose
   *      `kanban_status ∈ {IN_PROGRESS, IN_REVIEW, PENDING_APPROVAL,
   *      REVISION_REQUESTED}` → otherwise PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS.
   *      Tasks in TO_DO / ASSIGNED (not yet started) and DONE / CANCELLED
   *      (terminal) don't block.
   *   4. Flip status = LEFT, set left_at = NOW().
   *
   * After commit, the caller's `consultant_explore` caches are invalidated.
   *
   * @param projectId - UUID of the project to leave.
   * @returns The membership row in its now-LEFT state.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 403 PROJECT_NOT_MEMBER.
   * @throws TranslatableException 409 PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS.
   */
  leave(projectId: string): Promise<ConsultantMembershipResponseDto>;
}
