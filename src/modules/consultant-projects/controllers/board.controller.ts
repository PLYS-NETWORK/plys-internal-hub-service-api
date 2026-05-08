import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../../common/guards/platform.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ChangeTaskStatusDto, CreateBoardResultDto, UpdateBoardResultDto } from '../dto/requests';
import { ConsultantBoardResultResponseDto, ConsultantBoardTaskResponseDto } from '../dto/responses';
import { ConsultantBoardService } from '../services/board/board.service';
import { ConsultantBoardResultsService } from '../services/board/board-results.service';

@ApiTags('Consultant Projects — Board')
@ApiBearerAuth()
@Controller('projects/consultant/:id/board')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantBoardController {
  constructor(
    private readonly boardService: ConsultantBoardService,
    private readonly resultsService: ConsultantBoardResultsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List the kanban board for an active project member',
    description:
      'Returns every non-DRAFT task in the project, ordered by `display_order` ASC. Each row ' +
      'carries the assignee snapshot plus live `results_count`.',
  })
  public async listTasks(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ConsultantBoardTaskResponseDto[]>> {
    const data = await this.boardService.listTasks(id);
    return { messageKey: 'success.ok', data };
  }

  @Post(':taskId/assign-self')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Self-assign an unassigned TO_DO task (TO_DO → ASSIGNED)',
    description:
      'Atomic claim using SELECT...FOR UPDATE on the (TO_DO, unassigned) row. ' +
      'Returns 422 TASK_INVALID_STATUS_TRANSITION when the task is missing, in another status, ' +
      'or already assigned. ' +
      'Side effect: auto-transitions the project from `published` to `in_progress` on the first assignment.',
  })
  public async assignSelf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    await this.boardService.assignSelf(id, taskId);
  }

  @Post(':taskId/unassign-self')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Release the consultant's assignment (ASSIGNED → TO_DO)",
    description:
      'Allowed only while the task is still in ASSIGNED — once work has started ' +
      '(IN_PROGRESS or later) the consultant cannot drop the task without losing progress.',
  })
  public async unassignSelf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    await this.boardService.unassignSelf(id, taskId);
  }

  @Patch(':taskId/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Move a task between consultant-allowed kanban statuses',
    description:
      'Allowed transitions: ASSIGNED→IN_PROGRESS, IN_PROGRESS→IN_REVIEW, IN_REVIEW→IN_PROGRESS. ' +
      'First-time entry into IN_PROGRESS stamps `tasks.started_at`. ' +
      'Returns 409 TASK_CONSULTANT_ALREADY_IN_PROGRESS when target = IN_PROGRESS and the consultant ' +
      'already has another task in IN_PROGRESS.',
  })
  public async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ChangeTaskStatusDto,
  ): Promise<void> {
    await this.boardService.changeStatus(id, taskId, dto);
  }

  // ─── Results ───────────────────────────────────────────────────────────────

  @Post(':taskId/results')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a result on a task assigned to the calling consultant' })
  public async createResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateBoardResultDto,
  ): Promise<ITranslatedPayload<ConsultantBoardResultResponseDto>> {
    const data = await this.resultsService.create(id, taskId, dto);
    return { messageKey: 'success.created', data };
  }

  @Patch(':taskId/results/:resultId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own result; flips is_edited and replaces attachments' })
  public async updateResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @Body() dto: UpdateBoardResultDto,
  ): Promise<ITranslatedPayload<ConsultantBoardResultResponseDto>> {
    const data = await this.resultsService.update(id, taskId, resultId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Delete(':taskId/results/:resultId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete own result and detach its attachments' })
  public async deleteResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ): Promise<void> {
    await this.resultsService.delete(id, taskId, resultId);
  }
}
