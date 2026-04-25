import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../../common/guards/platform.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  AssignTaskDto,
  CreateTaskDto,
  ReorderTasksDto,
  UpdateTaskBusinessStatusDto,
} from '../dto/requests';
import { TaskResponseDto } from '../dto/responses';
import { BusinessTasksService } from './business-tasks.service';

@ApiTags('Tasks - Business')
@ApiBearerAuth()
@Controller('tasks-business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class TasksBusinessController {
  constructor(private readonly businessTasks: BusinessTasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft task for an in-progress project' })
  public async createTask(
    @Body() dto: CreateTaskDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.businessTasks.createDraftTask(dto);
    return { messageKey: 'success.task.created', data };
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a consultant to a task' })
  public async assignTask(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.businessTasks.assignTask(id, dto);
    return { messageKey: 'success.task.assigned', data };
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-update display order for a set of tasks' })
  public async reorderTasks(@Body() dto: ReorderTasksDto): Promise<void> {
    await this.businessTasks.reorderTasks(dto);
  }

  @Patch(':id/business-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change task status (business)' })
  public async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskBusinessStatusDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.businessTasks.updateStatus(id, dto);
    return { messageKey: 'success.task.status_updated', data };
  }

  @Get('by-project/:projectId/kanban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all non-draft tasks for a project (kanban board)' })
  public async listKanbanTasks(
    @Param('projectId') projectId: string,
  ): Promise<ITranslatedPayload<TaskResponseDto[]>> {
    const data = await this.businessTasks.listKanbanTasks(projectId);
    return { messageKey: 'success.ok', data };
  }

  @Get('by-project/:projectId/drafts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all draft tasks for a project' })
  public async listDraftTasks(
    @Param('projectId') projectId: string,
  ): Promise<ITranslatedPayload<TaskResponseDto[]>> {
    const data = await this.businessTasks.listDraftTasks(projectId);
    return { messageKey: 'success.ok', data };
  }
}
