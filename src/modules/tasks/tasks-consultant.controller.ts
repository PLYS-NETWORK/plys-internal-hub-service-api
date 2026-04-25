import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateTaskCommentDto,
  UpdateTaskCommentDto,
  UpdateTaskConsultantStatusDto,
} from './dto/requests';
import {
  ConsultantTaskResponseDto,
  TaskCommentResponseDto,
  TaskHistoryResponseDto,
  TaskResponseDto,
} from './dto/responses';
import { TaskCommentsService } from './services/task-comments.service';
import { TaskOperationsService } from './services/task-operations.service';

@ApiTags('Tasks - Consultant')
@ApiBearerAuth()
@Controller('tasks-consultant')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class TasksConsultantController {
  constructor(
    private readonly taskOps: TaskOperationsService,
    private readonly taskComments: TaskCommentsService,
  ) {}

  @Get('by-project/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tasks for a project the consultant is a member of (paginated)' })
  public async listProjectTasks(
    @Param('projectId') projectId: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantTaskResponseDto>>> {
    const data = await this.taskOps.listProjectTasksForConsultant(projectId, pageOptions);
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

  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get status and assignment history for a task (paginated)' })
  public async getTaskHistory(
    @Param('id') id: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<TaskHistoryResponseDto>>> {
    const data = await this.taskOps.getTaskHistory(id, pageOptions);
    return { messageKey: 'success.ok', data };
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a comment on a task' })
  public async createComment(
    @Param('id') id: string,
    @Body() dto: CreateTaskCommentDto,
  ): Promise<ITranslatedPayload<TaskCommentResponseDto>> {
    const data = await this.taskComments.createComment(id, dto);
    return { messageKey: 'success.task.comment_created', data };
  }

  @Get(':id/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List comments on a task (paginated)' })
  public async listComments(
    @Param('id') id: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<TaskCommentResponseDto>>> {
    const data = await this.taskComments.listComments(id, pageOptions);
    return { messageKey: 'success.ok', data };
  }

  @Patch('comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit own comment' })
  public async updateComment(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateTaskCommentDto,
  ): Promise<ITranslatedPayload<TaskCommentResponseDto>> {
    const data = await this.taskComments.updateComment(commentId, dto);
    return { messageKey: 'success.task.comment_updated', data };
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete own comment' })
  public async deleteComment(
    @Param('commentId') commentId: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.taskComments.deleteComment(commentId);
    return { messageKey: 'success.task.comment_deleted', data: null };
  }
}
