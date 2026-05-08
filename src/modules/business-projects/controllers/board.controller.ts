import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GetMilestonesDto, ListBoardTasksDto } from '../dto/requests';
import {
  BoardResultResponseDto,
  BoardTaskDetailResponseDto,
  BoardTaskHistoryResponseDto,
  BoardTaskResponseDto,
} from '../dto/responses';
import { BoardMilestonesResponseDto } from '../dto/responses/board-milestones-response.dto';
import { BoardService } from '../services/board/board.service';
import { BoardHistoryService } from '../services/board/board-history.service';
import { BoardMilestonesService } from '../services/board/board-milestones.service';
import { BoardResultsService } from '../services/board/board-results.service';

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
    private readonly resultsService: BoardResultsService,
    private readonly milestonesService: BoardMilestonesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List non-draft tasks with optional filters/sort, pagination, and short-TTL cache',
    description:
      'Returns non-DRAFT tasks in the project (paginated). Optional `status` and `assignee_id` ' +
      'filters narrow the set; `sort_by` accepts `total_worked_hours`, `created_at`, or ' +
      '`updated_at` (default), `order_by` accepts `ASC`/`DESC` (default DESC). Use `page` and ' +
      '`limit` (max 100, default 20) for pagination. The response is cached per ' +
      '(project, user, timezone, filter-set, page, limit) for ~60s; pass `is_remove_cache=true` ' +
      'to bypass and refresh. Date fields (`last_update`, `created_day`) are formatted using ' +
      'the timezone supplied via the `x-timezone` header (default UTC).',
  })
  public async listTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: ListBoardTasksDto,
  ): Promise<ITranslatedPayload<PageDto<BoardTaskResponseDto>>> {
    const data = await this.boardService.listTasks(id, filters);
    return { messageKey: 'success.ok', data };
  }

  @Get('milestones')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Task count summary grouped by kanban status (no DRAFT, no deleted)',
    description:
      'Returns the total number of tasks and per-status breakdowns for the project. ' +
      'DRAFT tasks and soft-deleted tasks are excluded from all counts.',
  })
  public async getMilestones(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: GetMilestonesDto,
  ): Promise<ITranslatedPayload<BoardMilestonesResponseDto>> {
    const data = await this.milestonesService.getSummary(id, filters);
    return { messageKey: 'success.ok', data };
  }

  @Get(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Task detail with attachments and time tracking' })
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

  // ─── Results ───────────────────────────────────────────────────────────────

  @Get(':taskId/results')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List consultant-submitted results for the task (paginated)' })
  public async listResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<BoardResultResponseDto>>> {
    const data = await this.resultsService.list(id, taskId, pageOptions);
    return { messageKey: 'success.ok', data };
  }
}
