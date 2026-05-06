import { AttachFilesDto, UpdateTaskAttachmentDto } from '../dto/requests';
import { BoardTaskAttachmentResponseDto } from '../dto/responses';

/**
 * Task-level file attachments (briefs, references, supporting docs uploaded
 * by the business owner). Distinct from `task_results` attachments, which
 * are authored by the assigned consultant.
 *
 * Two-step flow: client uploads via `/files/upload` first, then submits
 * `file_id`s here. The service snapshots metadata and flips the file's
 * `purpose` so the orphan-cleanup cron does not reclaim it.
 */
export interface IBoardAttachmentsService {
  /**
   * Snapshot one or more uploaded files as task attachments.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 400 TASK_ATTACHMENT_FILE_NOT_OWNED.
   */
  attach(
    projectId: string,
    taskId: string,
    dto: AttachFilesDto,
  ): Promise<BoardTaskAttachmentResponseDto[]>;

  /**
   * Update the display name on an attachment row.
   *
   * @throws TranslatableException 404 TASK_ATTACHMENT_NOT_FOUND.
   */
  update(
    projectId: string,
    taskId: string,
    attachmentId: string,
    dto: UpdateTaskAttachmentDto,
  ): Promise<BoardTaskAttachmentResponseDto>;

  /**
   * Soft-delete an attachment and orphan its underlying file so the cleanup
   * cron can reclaim storage.
   *
   * @throws TranslatableException 404 TASK_ATTACHMENT_NOT_FOUND.
   */
  remove(projectId: string, taskId: string, attachmentId: string): Promise<void>;
}
