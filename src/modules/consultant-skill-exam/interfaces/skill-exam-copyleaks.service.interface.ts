/**
 * Contract for the Copyleaks gate of the skill-exam pipeline.
 * Runs as the `RUN_SKILL_EXAM_COPYLEAKS` Bull job.
 */
export interface ISkillExamCopyleaksService {
  /**
   * Runs Copyleaks AI-content detection over the consultant's 20 answers
   * for the given exam.
   *
   * - On pass (`aggregateAiScore <= COPYLEAKS_PASS_MAX_AI_SCORE`): transitions
   *   the exam to `RUNNING_AI_EVAL` and enqueues `RUN_SKILL_EXAM_AI_EVAL`.
   * - On fail: increments the user's `aiStrikeCount`. If the strike count
   *   reaches `BAN_STRIKE_THRESHOLD` (3), sets `User.isActive = false`,
   *   `bannedAt`, `banReason = AI_CONTENT_ABUSE`, and emits
   *   `CONSULTANT_ACCOUNT_BANNED` after the FAILED event. Otherwise sets a
   *   7-day cooldown.
   *
   * Emits `CONSULTANT_SKILL_EXAM_FAILED` with `metadata.fail_reason =
   * 'COPYLEAKS_FAILED'` on the fail path.
   *
   * @param examId Skill exam UUID.
   */
  run(examId: string): Promise<void>;
}
