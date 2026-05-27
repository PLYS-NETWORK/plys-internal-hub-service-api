export enum SkillExamStatus {
  GENERATING_QUESTIONS = 'GENERATING_QUESTIONS',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  RUNNING_COPYLEAKS = 'RUNNING_COPYLEAKS',
  COPYLEAKS_FAILED = 'COPYLEAKS_FAILED',
  RUNNING_AI_EVAL = 'RUNNING_AI_EVAL',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum SkillExamFailReason {
  LOW_SCORE = 'LOW_SCORE',
  COPYLEAKS_FAILED = 'COPYLEAKS_FAILED',
  EXPIRED = 'EXPIRED',
}

// Statuses that count as "still active" — the consultant can't start a new exam
// while any of these are live, and the eligibility endpoint reports `pending_exam`.
// EXPIRED, COPYLEAKS_FAILED, FAILED and PASSED are terminal — not in this list.
export const SKILL_EXAM_IN_PROGRESS_STATUSES: readonly SkillExamStatus[] = [
  SkillExamStatus.GENERATING_QUESTIONS,
  SkillExamStatus.IN_PROGRESS,
  SkillExamStatus.SUBMITTED,
  SkillExamStatus.RUNNING_COPYLEAKS,
  SkillExamStatus.RUNNING_AI_EVAL,
];

/**
 * Logical, consultant-facing state. Hides the internal CopyLeaks/AI eval transitions
 * behind a single `PENDING_REVIEW` value so the Lonaos UI shows a steady "waiting for
 * review" state from submit through to terminal verdict.
 */
export enum ConsultantViewSkillExamStatus {
  GENERATING_QUESTIONS = 'GENERATING_QUESTIONS',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  EXPIRED = 'EXPIRED',
  COPYLEAKS_FAILED = 'COPYLEAKS_FAILED',
  FAILED = 'FAILED',
  PASSED = 'PASSED',
}

export function toConsultantViewStatus(s: SkillExamStatus): ConsultantViewSkillExamStatus {
  switch (s) {
    case SkillExamStatus.SUBMITTED:
    case SkillExamStatus.RUNNING_COPYLEAKS:
    case SkillExamStatus.RUNNING_AI_EVAL:
      return ConsultantViewSkillExamStatus.PENDING_REVIEW;
    default:
      return s as unknown as ConsultantViewSkillExamStatus;
  }
}
