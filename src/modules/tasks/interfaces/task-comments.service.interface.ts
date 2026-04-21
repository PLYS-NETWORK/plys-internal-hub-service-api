import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { CreateTaskCommentDto, UpdateTaskCommentDto } from '../dto/requests';
import { TaskCommentResponseDto } from '../dto/responses';

export interface ITaskCommentsService {
  createComment(taskId: string, dto: CreateTaskCommentDto): Promise<TaskCommentResponseDto>;
  listComments(
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskCommentResponseDto>>;
  updateComment(commentId: string, dto: UpdateTaskCommentDto): Promise<TaskCommentResponseDto>;
  deleteComment(commentId: string): Promise<void>;
}
