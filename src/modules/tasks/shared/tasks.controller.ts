import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { UserRole } from '@database/enums';
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

import { PlatformGuard } from '../../../common/guards/platform.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CreateTaskCommentDto, UpdateTaskCommentDto } from '../dto/requests';
import {
  TaskCommentResponseDto,
  TaskEvidenceResponseDto,
  TaskHistoryResponseDto,
} from '../dto/responses';
import { TaskAccessService } from './services/task-access.service';
import { TaskCommentsService } from './services/task-comments.service';
import { TaskEvidencesService } from './services/task-evidences.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
export class TasksController {
  constructor(
    private readonly taskAccess: TaskAccessService,
    private readonly taskComments: TaskCommentsService,
    private readonly taskEvidences: TaskEvidencesService,
  ) {}

  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get status and assignment history for a task (paginated)' })
  public async getTaskHistory(
    @Param('id') id: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<TaskHistoryResponseDto>>> {
    const data = await this.taskAccess.getTaskHistory(id, pageOptions);
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

  @Get(':id/evidences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List evidences on a task (project owner or ACTIVE member)' })
  public async listEvidences(
    @Param('id') id: string,
  ): Promise<ITranslatedPayload<TaskEvidenceResponseDto[]>> {
    const data = await this.taskEvidences.listEvidences(id);
    return { messageKey: 'success.ok', data };
  }
}
