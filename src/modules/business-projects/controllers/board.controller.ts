import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
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
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AssignTaskDto, UpdateTaskPositionsDto } from '../dto/requests';
import { BoardTaskDetailResponseDto, BoardTaskResponseDto } from '../dto/responses';
import { BoardService } from '../services/board.service';

@ApiTags('Business Projects — Board')
@ApiBearerAuth()
@Controller('projects/business/:id/board')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List non-draft tasks (kanban board) with assignee + counts' })
  public async listTasks(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<BoardTaskResponseDto[]>> {
    const data = await this.boardService.listTasks(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch('positions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-update kanban_status + display_order after a drag (atomic)' })
  public async updatePositions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskPositionsDto,
  ): Promise<void> {
    await this.boardService.updatePositions(id, dto);
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
  @ApiOperation({ summary: 'Assign an active project member to the task' })
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
}
