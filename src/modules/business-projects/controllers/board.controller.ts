import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AssignTaskDto,
  ChangeTaskStatusesDto,
  CreateBoardCommentDto,
  ReorderTasksDto,
  UpdateBoardCommentDto,
} from '../dto/requests';
import {
  BoardCommentResponseDto,
  BoardEvidenceResponseDto,
  BoardTaskDetailResponseDto,
  BoardTaskHistoryResponseDto,
  BoardTaskResponseDto,
} from '../dto/responses';
import { BoardService } from '../services/board/board.service';
import { BoardCommentsService } from '../services/board/board-comments.service';
import { BoardEvidencesService } from '../services/board/board-evidences.service';
import { BoardHistoryService } from '../services/board/board-history.service';

@ApiTags('Business Projects — Board')
@ApiBearerAuth()
@Controller('projects/business/:id/board')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BoardController {
  constructor(
    private readonly boardService: BoardService,
    private readonly commentsService: BoardCommentsService,
    private readonly historyService: BoardHistoryService,
    private readonly evidencesService: BoardEvidencesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List non-draft tasks (kanban board) with assignee + counts',
    description:
      'Returns every task in the project except DRAFT, ordered by `display_order` ASC ' +
      'within each `kanban_status`. Each task carries its human code (`<project_code>-<n>`) ' +
      'plus the assigned consultant (when present) and live `comments_count` / `evidences_count`.',
  })
  public async listTasks(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<BoardTaskResponseDto[]>> {
    const data = await this.boardService.listTasks(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch('orders')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reorder tasks within a single kanban column',
    description:
      'Updates `display_order` for tasks that already live in `current_status`. ' +
      'Up to 200 tasks per request; the service applies the changes in batches of 50 inside ' +
      'a single transaction with a project-level pessimistic lock so concurrent reorders ' +
      'serialise. Returns 422 `TASK_INVALID_STATUS_TRANSITION` when `current_status` is ' +
      'DRAFT/DONE/CANCELLED, when the payload contains duplicate `display_order` values, ' +
      'when a referenced task is missing, or when any task is not currently in `current_status`.',
  })
  public async reorderTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderTasksDto,
  ): Promise<void> {
    await this.boardService.reorderTasks(id, dto);
  }

  @Patch('statuses')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Move tasks between kanban columns',
    description:
      'Moves tasks to a new `kanban_status`. Each moved task is appended to the END of its ' +
      'destination column in the order it appears in the request body. Up to 200 tasks per ' +
      'request, batched 50 at a time inside one transaction with a project-level pessimistic ' +
      'lock. DRAFT/DONE/CANCELLED are owned by other flows (backlog payment, approval, ' +
      'cancellation) and rejected here in either direction. ' +
      'Returns 422 `TASK_INVALID_STATUS_TRANSITION` when any source or target status is in ' +
      '{DRAFT, DONE, CANCELLED}, when a referenced task is missing, or when a task is already ' +
      'in its requested target status (no-op moves).',
  })
  public async changeTaskStatuses(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTaskStatusesDto,
  ): Promise<void> {
    await this.boardService.changeTaskStatuses(id, dto);
  }

  @Get(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Task detail with comments_count + evidences_count' })
  public async getTaskDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<ITranslatedPayload<BoardTaskDetailResponseDto>> {
    const data = await this.boardService.getTaskDetail(id, taskId);
    return { messageKey: 'success.ok', data };
  }

  @Post(':taskId/assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Assign an active project member to the task',
    description:
      'Side effect: auto-transitions the project from `published` to `in_progress` on the first assignment. Once `in_progress`, republish is rejected.',
  })
  public async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignTaskDto,
  ): Promise<void> {
    await this.boardService.assign(id, taskId, dto);
  }

  @Post(':taskId/unassign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the assignment (only TO_DO/ASSIGNED tasks)' })
  public async unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    await this.boardService.unassign(id, taskId);
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  @Get(':taskId/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List comments for a task (paginated)',
    description:
      'Returns non-deleted comments in `created_at DESC` order. Author display fields ' +
      'are resolved by joining `consultant_profiles` and `business_profiles` so both ' +
      'consultant- and business-authored comments render with a consistent shape. ' +
      'Snapshotted attachments are returned alongside each comment.',
  })
  public async listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<BoardCommentResponseDto>>> {
    const data = await this.commentsService.list(id, taskId, pageOptions);
    return { messageKey: 'success.ok', data };
  }

  @Post(':taskId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a comment on a task with optional file attachments' })
  public async createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateBoardCommentDto,
  ): Promise<ITranslatedPayload<BoardCommentResponseDto>> {
    const data = await this.commentsService.create(id, taskId, dto);
    return { messageKey: 'success.created', data };
  }

  @Patch(':taskId/comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own comment; flips is_edited and replaces attachments' })
  public async updateComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateBoardCommentDto,
  ): Promise<ITranslatedPayload<BoardCommentResponseDto>> {
    const data = await this.commentsService.update(id, taskId, commentId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Delete(':taskId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete own comment and remove its attachments' })
  public async deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    await this.commentsService.delete(id, taskId, commentId);
  }

  // ─── History ───────────────────────────────────────────────────────────────

  @Get(':taskId/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List task history (status & assignment changes) with author display' })
  public async listHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<BoardTaskHistoryResponseDto>>> {
    const data = await this.historyService.list(id, taskId, pageOptions);
    return { messageKey: 'success.ok', data };
  }

  // ─── Evidences ─────────────────────────────────────────────────────────────

  @Get(':taskId/evidences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List consultant-submitted evidences for the task (paginated)' })
  public async listEvidences(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<BoardEvidenceResponseDto>>> {
    const data = await this.evidencesService.list(id, taskId, pageOptions);
    return { messageKey: 'success.ok', data };
  }
}
