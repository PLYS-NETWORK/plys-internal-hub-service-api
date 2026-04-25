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
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../../common/guards/platform.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  CreateTaskEvidenceDto,
  UpdateTaskConsultantStatusDto,
  UpdateTaskEvidenceDto,
} from '../dto/requests';
import {
  ConsultantTaskResponseDto,
  TaskEvidenceResponseDto,
  TaskResponseDto,
} from '../dto/responses';
import { TaskEvidencesService } from '../shared/services/task-evidences.service';
import { ConsultantTasksService } from './consultant-tasks.service';

@ApiTags('Tasks - Consultant')
@ApiBearerAuth()
@Controller('tasks-consultant')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class TasksConsultantController {
  constructor(
    private readonly consultantTasks: ConsultantTasksService,
    private readonly taskEvidences: TaskEvidencesService,
  ) {}

  @Get('by-project/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all tasks for a project the consultant is a member of' })
  public async listProjectTasks(
    @Param('projectId') projectId: string,
  ): Promise<ITranslatedPayload<ConsultantTaskResponseDto[]>> {
    const data = await this.consultantTasks.listProjectTasks(projectId);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/consultant-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change task status (consultant)' })
  public async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskConsultantStatusDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.consultantTasks.updateStatus(id, dto);
    return { messageKey: 'success.task.status_updated', data };
  }

  @Post(':id/evidences')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an evidence on a task — assigned consultant only' })
  public async createEvidence(
    @Param('id') id: string,
    @Body() dto: CreateTaskEvidenceDto,
  ): Promise<ITranslatedPayload<TaskEvidenceResponseDto>> {
    const data = await this.taskEvidences.createEvidence(id, dto);
    return { messageKey: 'success.task.evidence_created', data };
  }

  @Patch('evidences/:evidenceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit own evidence (remarks and/or replace attachments)' })
  public async updateEvidence(
    @Param('evidenceId') evidenceId: string,
    @Body() dto: UpdateTaskEvidenceDto,
  ): Promise<ITranslatedPayload<TaskEvidenceResponseDto>> {
    const data = await this.taskEvidences.updateEvidence(evidenceId, dto);
    return { messageKey: 'success.task.evidence_updated', data };
  }

  @Delete('evidences/:evidenceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete own evidence' })
  public async deleteEvidence(
    @Param('evidenceId') evidenceId: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.taskEvidences.deleteEvidence(evidenceId);
    return { messageKey: 'success.task.evidence_deleted', data: null };
  }
}
