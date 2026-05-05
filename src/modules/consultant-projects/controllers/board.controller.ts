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
import {
  ChangeTaskStatusDto,
  CreateBoardEvidenceDto,
  UpdateBoardEvidenceDto,
} from '../dto/requests';
import {
  ConsultantBoardEvidenceResponseDto,
  ConsultantBoardTaskResponseDto,
} from '../dto/responses';
import { ConsultantBoardService } from '../services/board/board.service';
import { ConsultantBoardEvidencesService } from '../services/board/board-evidences.service';

@ApiTags('Consultant Projects — Board')
@ApiBearerAuth()
@Controller('projects/consultant/:id/board')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantBoardController {
  constructor(
    private readonly boardService: ConsultantBoardService,
    private readonly evidencesService: ConsultantBoardEvidencesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List the kanban board for an active project member',
    description:
      'Returns every non-DRAFT task in the project, ordered by `display_order` ASC. Each row ' +
      'carries the assignee snapshot plus live `evidences_count`.',
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

  // ─── Evidences ─────────────────────────────────────────────────────────────

  @Post(':taskId/evidences')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create evidence on a task assigned to the calling consultant' })
  public async createEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateBoardEvidenceDto,
  ): Promise<ITranslatedPayload<ConsultantBoardEvidenceResponseDto>> {
    const data = await this.evidencesService.create(id, taskId, dto);
    return { messageKey: 'success.created', data };
  }

  @Patch(':taskId/evidences/:evidenceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own evidence; flips is_edited and replaces attachments' })
  public async updateEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() dto: UpdateBoardEvidenceDto,
  ): Promise<ITranslatedPayload<ConsultantBoardEvidenceResponseDto>> {
    const data = await this.evidencesService.update(id, taskId, evidenceId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Delete(':taskId/evidences/:evidenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete own evidence and detach its attachments' })
  public async deleteEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ): Promise<void> {
    await this.evidencesService.delete(id, taskId, evidenceId);
  }
}
