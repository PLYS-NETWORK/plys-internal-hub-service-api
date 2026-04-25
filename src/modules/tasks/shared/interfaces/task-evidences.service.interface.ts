import { CreateTaskEvidenceDto, UpdateTaskEvidenceDto } from '../../dto/requests';
import { TaskEvidenceResponseDto } from '../../dto/responses';

/**
 * Contract for task evidence operations.
 *
 * Evidences are structured proof-of-work records authored by the consultant
 * currently assigned to a task. They consist of a rich-text JSON document
 * (`remarks`) and zero-or-more file attachments. Caller identity is resolved
 * internally via `RequestContextService` — no `userId` parameter is accepted.
 */
export interface ITaskEvidencesService {
  /**
   * Creates an evidence on the given task. Caller must be the consultant
   * currently set as `tasks.assigned_to`. If `fileIds` is supplied, every file
   * must belong to the caller — the file metadata is snapshotted into the
   * attachment row at creation time so the evidence stays durable even if the
   * source `files` row is later removed.
   *
   * @param taskId UUID of the task to attach the evidence to.
   * @param dto    Validated evidence payload (`remarks`, optional `fileIds`).
   * @returns The newly created evidence DTO with its attachments.
   * @throws TranslatableException (404) — task not found.
   * @throws TranslatableException (403) — caller is not the assigned consultant.
   * @throws TranslatableException (400) — one or more `fileIds` are not owned by the caller.
   */
  createEvidence(taskId: string, dto: CreateTaskEvidenceDto): Promise<TaskEvidenceResponseDto>;

  /**
   * Returns all non-deleted evidences for a task, ordered by `created_at` ASC.
   * Readable by the project-owning business or any ACTIVE project member
   * (consultant). Pagination is omitted by design — evidence count per task is
   * expected to stay small.
   *
   * @param taskId UUID of the task whose evidences to list.
   * @returns Array of evidence DTOs with attachments embedded.
   * @throws TranslatableException (404) — task not found.
   * @throws TranslatableException (403) — caller is neither the project owner nor an ACTIVE member.
   */
  listEvidences(taskId: string): Promise<TaskEvidenceResponseDto[]>;

  /**
   * Updates an evidence. Only the original author may edit. When `remarks` is
   * provided, sets `is_edited: true` and records `edited_at`. When `fileIds`
   * is provided (even as `[]`), fully replaces the attachment list.
   *
   * @param evidenceId UUID of the evidence to update.
   * @param dto        Validated patch (`remarks?`, `fileIds?`).
   * @returns The updated evidence DTO with attachments.
   * @throws TranslatableException (404) — evidence not found or already deleted.
   * @throws TranslatableException (403) — caller is not the evidence author.
   * @throws TranslatableException (400) — empty patch (neither field provided).
   * @throws TranslatableException (400) — one or more `fileIds` are not owned by the caller.
   */
  updateEvidence(evidenceId: string, dto: UpdateTaskEvidenceDto): Promise<TaskEvidenceResponseDto>;

  /**
   * Soft-deletes an evidence by setting `is_deleted: true`. Only the original
   * author may delete. Attachments remain in the database but are excluded
   * from list responses.
   *
   * @param evidenceId UUID of the evidence to delete.
   * @throws TranslatableException (404) — evidence not found or already deleted.
   * @throws TranslatableException (403) — caller is not the evidence author.
   */
  deleteEvidence(evidenceId: string): Promise<void>;
}
