/**
 * Centralized i18n message keys for tasks module errors. Every `messageKey`
 * value passed to `TranslatableException` from inside `src/modules/tasks/`
 * must reference this object — no inline string literals.
 *
 * The corresponding translations live in `src/i18n/{locale}/error.json` under
 * `task.*`. When adding an entry here, add the matching key to both en and tr.
 */
export const TASK_ERRORS = {
  NOT_FOUND: 'error.task.not_found',
  INVALID_STATUS_TRANSITION: 'error.task.invalid_status_transition',
  ALREADY_ASSIGNED: 'error.task.already_assigned',
  CONSULTANT_NOT_PROJECT_MEMBER: 'error.task.consultant_not_project_member',
  PROJECT_NOT_IN_PROGRESS: 'error.task.project_not_in_progress',
  CONSULTANT_ALREADY_IN_PROGRESS: 'error.task.consultant_already_in_progress',
  COMMENT_NOT_FOUND: 'error.task.comment_not_found',
  COMMENT_FORBIDDEN: 'error.task.comment_forbidden',
} as const;

export type TaskErrorKey = (typeof TASK_ERRORS)[keyof typeof TASK_ERRORS];
