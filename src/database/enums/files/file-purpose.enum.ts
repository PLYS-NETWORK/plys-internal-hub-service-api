/**
 * Server-managed marker on `files.purpose` indicating which surface owns
 * an uploaded file. Set when the file is attached, cleared back to NULL
 * when it is replaced/detached so the orphan-cleanup cron can reclaim it.
 *
 * `CONSULTANT_CV` is set by the client at upload time (the only purpose
 * accepted on POST /files): when present, the storage key is prefixed
 * with `consultant-CVs/<env>/` instead of the default sharded path.
 */
export enum FilePurpose {
  TASK_COMMENT = 'task_comment',
  TASK_RESULT = 'task_result',
  TASK_ATTACHMENT = 'task_attachment',
  CONSULTANT_CV = 'consultant_cv',
}
