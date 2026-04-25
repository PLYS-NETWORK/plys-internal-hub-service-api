import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { CreateTaskCommentDto, UpdateTaskCommentDto } from '../../dto/requests';
import { TaskCommentResponseDto } from '../../dto/responses';

/**
 * Contract for task comment operations.
 *
 * Access is restricted to participants of the task's project: either the
 * business that owns the project or a consultant with `ACTIVE` membership.
 * Caller identity is resolved internally via `RequestContextService`.
 */
export interface ITaskCommentsService {
  /**
   * Creates a comment on a task. The caller must be either the project-owning
   * business or an `ACTIVE` project member (consultant).
   *
   * @param taskId - UUID of the task to comment on.
   * @param dto    - Validated comment payload containing `body`.
   * @returns The newly created comment DTO.
   * @throws TranslatableException (404) — task not found.
   * @throws TranslatableException (403) — caller is not a project participant.
   */
  createComment(taskId: string, dto: CreateTaskCommentDto): Promise<TaskCommentResponseDto>;

  /**
   * Returns a paginated list of non-deleted comments for a task, ordered by
   * `created_at` ascending (chronological thread order).
   *
   * @param taskId      - UUID of the task whose comments to list.
   * @param pageOptions - Pagination parameters (page, take).
   * @returns Paginated wrapper containing comment DTOs and page metadata.
   */
  listComments(
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskCommentResponseDto>>;

  /**
   * Updates the body of an existing comment. Only the original author may edit
   * their own comment. Sets `is_edited: true` and records `edited_at` timestamp.
   *
   * @param commentId - UUID of the comment to update.
   * @param dto       - Validated payload containing the new `body`.
   * @returns The updated comment DTO with `is_edited: true`.
   * @throws TranslatableException (404) — comment not found or already deleted.
   * @throws TranslatableException (403) — caller is not the comment author.
   */
  updateComment(commentId: string, dto: UpdateTaskCommentDto): Promise<TaskCommentResponseDto>;

  /**
   * Soft-deletes a comment by setting `is_deleted: true`. Only the original
   * author may delete their own comment.
   *
   * @param commentId - UUID of the comment to delete.
   * @throws TranslatableException (404) — comment not found or already deleted.
   * @throws TranslatableException (403) — caller is not the comment author.
   */
  deleteComment(commentId: string): Promise<void>;
}
