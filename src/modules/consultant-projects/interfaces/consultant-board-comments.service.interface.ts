import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { CreateBoardCommentDto, UpdateBoardCommentDto } from '../dto/requests';
import { ConsultantBoardCommentResponseDto } from '../dto/responses';

export interface IConsultantBoardCommentsService {
  /**
   * Returns paginated, non-deleted comments for a non-DRAFT task in a project
   * the calling consultant is an ACTIVE member of, ordered `created_at DESC`.
   * Author display fields resolve through `consultant_profiles` and
   * `business_profiles` so both consultant- and business-authored comments
   * render with a consistent shape; `consultant_id` is `null` when the
   * comment was authored by a business owner.
   *
   * @throws TranslatableException 403 PROJECT_FORBIDDEN — caller is not an active member.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   */
  list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ConsultantBoardCommentResponseDto>>;

  /**
   * Creates a comment authored by the calling consultant on a task in a
   * project they are an ACTIVE member of. Up to 10 file attachments may be
   * supplied; each must be owned by the caller.
   *
   * @throws TranslatableException 403 PROJECT_FORBIDDEN — caller is not an active member.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 400 TASK_COMMENT_FILE_NOT_OWNED.
   */
  create(
    projectId: string,
    taskId: string,
    dto: CreateBoardCommentDto,
  ): Promise<ConsultantBoardCommentResponseDto>;

  /**
   * Updates an own comment. Replaces attachments wholesale when `file_ids` is
   * provided. Sets `is_edited = true` if `comment` is supplied.
   *
   * @throws TranslatableException 400 TASK_COMMENT_EMPTY_UPDATE — no fields to update.
   * @throws TranslatableException 404 TASK_COMMENT_NOT_FOUND.
   * @throws TranslatableException 403 TASK_COMMENT_FORBIDDEN — caller is not the author.
   */
  update(
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateBoardCommentDto,
  ): Promise<ConsultantBoardCommentResponseDto>;

  /**
   * Soft-deletes own comment and detaches its attachments.
   *
   * @throws TranslatableException 404 TASK_COMMENT_NOT_FOUND.
   * @throws TranslatableException 403 TASK_COMMENT_FORBIDDEN.
   */
  delete(projectId: string, taskId: string, commentId: string): Promise<void>;
}
