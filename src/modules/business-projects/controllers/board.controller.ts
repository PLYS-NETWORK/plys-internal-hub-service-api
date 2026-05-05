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
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ReorderTasksDto } from '../dto/requests';
import {
  BoardEvidenceResponseDto,
  BoardTaskDetailResponseDto,
  BoardTaskHistoryResponseDto,
  BoardTaskResponseDto,
} from '../dto/responses';
import { BoardService } from '../services/board/board.service';
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
      'plus the assigned consultant (when present) and live `evidences_count`.',
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

  @Get(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Task detail with evidences_count' })
  public async getTaskDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<ITranslatedPayload<BoardTaskDetailResponseDto>> {
    const data = await this.boardService.getTaskDetail(id, taskId);
    return { messageKey: 'success.ok', data };
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
