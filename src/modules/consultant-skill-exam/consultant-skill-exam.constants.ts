export const SKILL_EXAM_QUEUE = 'consultant-skill-exam';

export const SKILL_EXAM_JOBS = {
  GENERATE_SKILL_EXAM_QUESTIONS: 'GENERATE_SKILL_EXAM_QUESTIONS',
  RUN_SKILL_EXAM_COPYLEAKS: 'RUN_SKILL_EXAM_COPYLEAKS',
  RUN_SKILL_EXAM_AI_EVAL: 'RUN_SKILL_EXAM_AI_EVAL',
} as const;

export type SkillExamJob = (typeof SKILL_EXAM_JOBS)[keyof typeof SKILL_EXAM_JOBS];

export interface ISkillExamJobPayload {
  readonly exam_id: string;
}

export const TOTAL_SKILL_EXAM_QUESTIONS = 20;

// Only one in-flight exam at a time per consultant. Together with the
// SKILL_EXAM_IN_PROGRESS_STATUSES set, this gates `start` against any non-terminal
// exam (GENERATING_QUESTIONS, IN_PROGRESS, SUBMITTED, RUNNING_COPYLEAKS, RUNNING_AI_EVAL).
export const MAX_PARALLEL_EXAMS = 1;

// 60-minute exam timer; expires_at = in_progress_at + 60 min. Lazy-checked on every
// consultant call and reaped by the 5-minute sweep job.
export const EXAM_DURATION_MIN = 60;

// 3rd EXPIRED attempt triggers the platform-wide block. Counter is reset on a
// passing exam (any skill) or when the cooldown expires and the consultant
// re-attempts start.
export const EXPIRED_RETRY_LIMIT = 3;
export const EXAM_TAKING_COOLDOWN_DAYS = 2;

// Per-answer AI score threshold: an answer is "correct" when score >= this.
export const ANSWER_CORRECTNESS_THRESHOLD = 60;

// Score bands (overall_score is 0-100):
//   < BEGINNER_MAX        → BEGINNER (fail)
//   < INTERMEDIATE_MAX    → INTERMEDIATE (fail)
//   < EXPERT_THRESHOLD    → SENIOR (pass)
//   >= EXPERT_THRESHOLD   → EXPERT (pass)
export const BEGINNER_MAX = 40;
export const INTERMEDIATE_MAX = 80;
export const PASS_THRESHOLD = 80;
export const EXPERT_THRESHOLD = 90;

// Per-skill retake cooldown after a low-score fail (BEGINNER / INTERMEDIATE).
// Written to consultant_skill_exams.cooldown_until on the failed row.
export const LOW_SCORE_COOLDOWN_DAYS = 30;

// Per-skill retake cooldown when CopyLeaks flags the submission as AI-generated.
// Separate from the lifetime 3-strike ban (BAN_STRIKE_THRESHOLD) — the cooldown
// limits retakes for THIS skill, the ban locks the whole account.
export const COPYLEAKS_COOLDOWN_DAYS = 7;

// Aggregate Copyleaks aiScore (0-100). Above this we treat the submission as
// AI-generated and fail the gate.
export const COPYLEAKS_PASS_MAX_AI_SCORE = 30;

// 3rd CopyLeaks strike → permanent ban (users.is_active = false, sessions revoked).
export const BAN_STRIKE_THRESHOLD = 3;

// avgRating threshold for the notification-priority benefit. Recomputed on every
// PASS and written back to ConsultantProfile.hasNotificationPriority.
export const AVG_RATING_PRIORITY_THRESHOLD = 90;
