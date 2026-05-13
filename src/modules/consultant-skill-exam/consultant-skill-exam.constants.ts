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
export const PASS_THRESHOLD = 80;
export const EXPERT_THRESHOLD = 90;
/** Per-answer aiEvalScore at or above which we treat the answer as "correct". */
export const ANSWER_CORRECTNESS_THRESHOLD = 60;
/** Max acceptable Copyleaks aggregate aiScore (0–100). Above this we treat the submission as AI-generated. */
export const COPYLEAKS_PASS_MAX_AI_SCORE = 30;
export const COOLDOWN_DAYS = 7;
export const MAX_PARALLEL_EXAMS = 2;
export const BAN_STRIKE_THRESHOLD = 3;
