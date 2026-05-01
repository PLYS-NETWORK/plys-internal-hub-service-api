import { CreateBoardCommentDto, UpdateBoardCommentDto } from '../dto/requests';
import { BoardCommentResponseDto } from '../dto/responses';

/**
 * Board-scoped task-comment CRUD for the BUSINESS surface. Each method
 * resolves project ownership via `BusinessAccessService.resolveOwnedProject`
 * before touching any data.
 */
export interface IBoardCommentsService {
  /**
   * Creates a comment on a non-DRAFT task and optionally attaches up to 10
   * caller-owned files. Files are referenced by id and snapshotted into
   * `task_comment_attachments` so the comment stays meaningful even after
   * the canonical `files` row is later soft-deleted.
   *
   * @param projectId UUID of the project. Caller must own it.
   * @param taskId    UUID of the target task. Must belong to the project and
   *                  must not be in DRAFT (drafts have no board surface).
   * @param dto       Comment body and optional `file_ids` (≤ 10 UUIDs, all
   *                  must be owned by the caller).
   * @returns The created comment with resolved author + snapshotted attachments.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND if the caller
   *         has no active business profile.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND if the project is
   *         missing or owned by another business.
   * @throws TranslatableException 404 TASK_NOT_FOUND if the task is missing,
   *         soft-deleted, or in DRAFT.
   * @throws TranslatableException 400 TASK_COMMENT_FILE_NOT_OWNED if any
   *         supplied `file_id` is missing, soft-deleted, or owned by another user.
   */
  create(
    projectId: string,
    taskId: string,
    dto: CreateBoardCommentDto,
  ): Promise<BoardCommentResponseDto>;

  /**
   * Updates the caller's own comment. Setting `comment` flips `is_edited` to
   * `true` and stamps `edited_at`. When `file_ids` is provided (including
   * `[]`), the previous attachment rows are deleted and any newly listed
   * files are snapshotted in their place. Detached files are soft-deleted so
   * their bytes are reclaimed by the daily purge cron.
   *
   * @param projectId  UUID of the project. Caller must own it.
   * @param taskId     UUID of the target task.
   * @param commentId  UUID of the comment to update.
   * @param dto        Partial body (must include at least one of `comment`,
   *                   `file_ids`).
   * @returns The updated comment with resolved author + current attachments.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 404 TASK_COMMENT_NOT_FOUND.
   * @throws TranslatableException 403 TASK_COMMENT_FORBIDDEN if the caller
   *         is not the comment's author.
   * @throws TranslatableException 400 TASK_COMMENT_EMPTY_UPDATE if neither
   *         field is supplied.
   * @throws TranslatableException 400 TASK_COMMENT_FILE_NOT_OWNED.
   */
  update(
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateBoardCommentDto,
  ): Promise<BoardCommentResponseDto>;

  /**
   * Soft-deletes the comment (`is_deleted=true`), hard-deletes its attachment
   * rows, and soft-deletes the underlying `files` rows so storage is
   * reclaimed by the daily purge cron. Bytes remain reachable until that
   * cron runs — callers expecting an instant 404 on the file URL should not
   * rely on this method.
   *
   * @param projectId UUID of the project. Caller must own it.
   * @param taskId    UUID of the target task.
   * @param commentId UUID of the comment to remove.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 404 TASK_COMMENT_NOT_FOUND.
   * @throws TranslatableException 403 TASK_COMMENT_FORBIDDEN if the caller
   *         is not the comment's author.
   */
  delete(projectId: string, taskId: string, commentId: string): Promise<void>;
}
