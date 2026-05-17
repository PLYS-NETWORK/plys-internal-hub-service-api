import { THROTTLE_DEFAULT, THROTTLE_STRICT } from '@common/constants';
import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
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
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AssignConsultantTaskDto } from '../dto/requests/assign-consultant-task.dto';
import { ListConsultantProjectTasksDto } from '../dto/requests/list-consultant-project-tasks.dto';
import {
  ConsultantProjectTaskListItemResponseDto,
  ConsultantTaskSummaryResponseDto,
} from '../dto/responses';
import { ConsultantProjectTasksService } from '../services/consultant-project-tasks.service';

@ApiTags('Consultant Projects — Tasks')
@ApiBearerAuth()
@Controller('projects/consultant/joined/:projectId/tasks')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
@Throttle(THROTTLE_DEFAULT)
export class ConsultantProjectTasksController {
  constructor(private readonly service: ConsultantProjectTasksService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List tasks for a joined project. Shows unassigned TO_DO tasks plus the caller-owned non-DRAFT tasks. Ordered IN_PROGRESS → TO_DO → others. Cached 60 s.',
  })
  public async listTasks(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query() dto: ListConsultantProjectTasksDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantProjectTaskListItemResponseDto>>> {
    const data = await this.service.listTasks(projectId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Post(':taskId/assign')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_STRICT)
  @ApiOperation({
    summary:
      'Self-claim a TO_DO task. Promotes to IN_PROGRESS and persists the due date. Race-safe via SELECT FOR UPDATE SKIP LOCKED. Throttled 5 req/min.',
  })
  public async assignTask(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: AssignConsultantTaskDto,
  ): Promise<ITranslatedPayload<ConsultantTaskSummaryResponseDto>> {
    const data = await this.service.assignTask(projectId, taskId, dto);
    return { messageKey: 'success.task.assigned', data };
  }

  @Post(':taskId/unassign')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_STRICT)
  @ApiOperation({
    summary:
      'Release an IN_PROGRESS task the caller owns. Clears `due_date` and `assigned_at`; status flips back to TO_DO. Throttled 5 req/min.',
  })
  public async unassignTask(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ): Promise<ITranslatedPayload<ConsultantTaskSummaryResponseDto>> {
    const data = await this.service.unassignTask(projectId, taskId);
    return { messageKey: 'success.task.unassigned', data };
  }

  @Post(':taskId/submit-for-review')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_STRICT)
  @ApiOperation({
    summary:
      'Submit a caller-owned IN_PROGRESS task for the business owner to review. Status flips to IN_REVIEW. Throttled 5 req/min.',
  })
  public async submitForReview(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ): Promise<ITranslatedPayload<ConsultantTaskSummaryResponseDto>> {
    const data = await this.service.submitForReview(projectId, taskId);
    return { messageKey: 'success.task.submitted_for_review', data };
  }
}
