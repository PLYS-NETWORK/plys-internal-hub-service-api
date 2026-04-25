// Centralised request-side limits for the projects module. Keeping them in
// one file ensures Create and Update DTOs stay in lock-step and the limits
// can be tightened in a single place.

export const PROJECT_TITLE_MIN = 3;
export const PROJECT_TITLE_MAX = 300;
export const PROJECT_REQUIRED_CONSULTANTS_MAX = 100;
export const PROJECT_SKILLS_MAX = 50;
export const PROJECT_INTERVIEW_QUESTIONS_MAX = 30;
export const PROJECT_TASKS_MAX = 100;
export const PROJECT_KEYWORDS_MIN = 2;
export const PROJECT_KEYWORDS_MAX = 200;

export const TASK_TITLE_MIN = 3;
export const TASK_TITLE_MAX = 300;
export const TASK_DESCRIPTION_MAX = 5000;
// Aligns with `tasks.price` numeric(12,2): max 9_999_999_999.99.
export const TASK_PRICE_MAX = 9_999_999_999.99;

export const INTERVIEW_QUESTION_MIN = 5;
export const INTERVIEW_QUESTION_MAX = 500;
