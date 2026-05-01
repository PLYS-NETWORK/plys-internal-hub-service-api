/**
 * Server-managed marker on `files.purpose` indicating which surface owns
 * an uploaded file. Set when the file is attached, cleared back to NULL
 * when it is replaced/detached so the orphan-cleanup cron can reclaim it.
 */
export enum FilePurpose {
  TASK_COMMENT = 'task_comment',
  TASK_EVIDENCE = 'task_evidence',
}
