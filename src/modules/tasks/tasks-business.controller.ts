import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
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
  AssignTaskDto,
  CreateTaskCommentDto,
  CreateTaskDto,
  UpdateTaskBusinessStatusDto,
  UpdateTaskCommentDto,
} from './dto/requests';
import { TaskCommentResponseDto, TaskResponseDto } from './dto/responses';
import { TaskCommentsService } from './services/task-comments.service';
import { TaskOperationsService } from './services/task-operations.service';

@ApiTags('Tasks - Business')
@ApiBearerAuth()
@Controller('tasks-business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class TasksBusinessController {
  constructor(
    private readonly taskOps: TaskOperationsService,
    private readonly taskComments: TaskCommentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft task for an in-progress project' })
  public async createTask(
    @Body() dto: CreateTaskDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.taskOps.createDraftTask(dto);
    return { messageKey: 'success.task.created', data };
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a consultant to a task' })
  public async assignTask(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.taskOps.assignTask(id, dto);
    return { messageKey: 'success.task.assigned', data };
  }

  @Patch(':id/business-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change task status (business)' })
  public async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskBusinessStatusDto,
  ): Promise<ITranslatedPayload<TaskResponseDto>> {
    const data = await this.taskOps.updateBusinessStatus(id, dto);
    return { messageKey: 'success.task.status_updated', data };
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
