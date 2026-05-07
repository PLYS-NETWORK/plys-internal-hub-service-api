import { AttachFilesDto, UpdateTaskAttachmentDto } from '../dto/requests';
import { TaskAttachmentResponseDto } from '../dto/responses';

/**
 * Task-level file attachments (briefs, references, supporting docs uploaded
 * by the business owner). Distinct from `task_results` attachments, which
 * are authored by the assigned consultant.
 *
 * Two-step flow: client uploads via `POST /files` first, then submits
 * `file_id`s here. The service snapshots metadata and flips the file's
 * `purpose` so the orphan-cleanup cron does not reclaim it.
 *
 * Allowed task statuses: DRAFT and TO_DO. Once the consultant picks the task
 * up (IN_PROGRESS onwards) the surface is frozen for the business owner —
 * 422 `TASK_INVALID_STATUS_TRANSITION` is returned.
 */
export interface ITaskAttachmentsService {
  /**
   * Snapshot one or more uploaded files as task attachments.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION when the
   *   task is not DRAFT or TO_DO.
   * @throws TranslatableException 400 TASK_ATTACHMENT_FILE_NOT_OWNED.
   */
  attach(
    projectId: string,
    taskId: string,
    dto: AttachFilesDto,
  ): Promise<TaskAttachmentResponseDto[]>;

  /**
   * Update the display name on an attachment row.
   *
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION when the
   *   task is not DRAFT or TO_DO.
   * @throws TranslatableException 404 TASK_ATTACHMENT_NOT_FOUND.
   */
  update(
    projectId: string,
    taskId: string,
    attachmentId: string,
    dto: UpdateTaskAttachmentDto,
  ): Promise<TaskAttachmentResponseDto>;

  /**
   * Soft-delete an attachment and orphan its underlying file so the cleanup
   * cron can reclaim storage.
   *
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION when the
   *   task is not DRAFT or TO_DO.
   * @throws TranslatableException 404 TASK_ATTACHMENT_NOT_FOUND.
   */
  remove(projectId: string, taskId: string, attachmentId: string): Promise<void>;
}
