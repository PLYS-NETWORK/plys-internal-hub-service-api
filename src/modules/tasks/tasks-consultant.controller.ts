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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateTaskConsultantStatusDto } from './dto/requests';
import { ConsultantTaskResponseDto, TaskResponseDto } from './dto/responses';
import { TaskOperationsService } from './services/task-operations.service';

@ApiTags('Tasks - Consultant')
@ApiBearerAuth()
@Controller('tasks-consultant')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class TasksConsultantController {
  constructor(private readonly taskOps: TaskOperationsService) {}

  @Get('by-project/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all tasks for a project the consultant is a member of' })
  public async listProjectTasks(
    @Param('projectId') projectId: string,
  ): Promise<ITranslatedPayload<ConsultantTaskResponseDto[]>> {
    const data = await this.taskOps.listProjectTasksForConsultant(projectId);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/consultant-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change task status (consultant)' })
  public async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskConsultantStatusDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.taskOps.updateConsultantStatus(id, dto);
    return { messageKey: 'success.task.status_updated', data };
  }
}
