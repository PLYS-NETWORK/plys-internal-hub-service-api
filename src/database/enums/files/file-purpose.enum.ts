/**
 * Server-managed marker on `files.purpose` indicating which surface owns
 * an uploaded file. Set when the file is attached, cleared back to NULL
 * when it is replaced/detached so the orphan-cleanup cron can reclaim it.
 */
export enum FilePurpose {
  TASK_COMMENT = 'task_comment',
  TASK_RESULT = 'task_result',
  TASK_ATTACHMENT = 'task_attachment',
}
