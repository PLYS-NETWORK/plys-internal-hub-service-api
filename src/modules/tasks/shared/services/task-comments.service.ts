import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectMemberStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { CreateTaskCommentDto, UpdateTaskCommentDto } from '../../dto/requests';
import { TaskCommentResponseDto } from '../../dto/responses';
import { TASK_ERRORS } from '../constants/task-error-messages.constant';
import { ITaskCommentsService } from '../interfaces/task-comments.service.interface';
import { TaskAccessService } from './task-access.service';
import { TaskMapperService } from './task-mapper.service';

@Injectable()
export class TaskCommentsService implements ITaskCommentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly taskAccess: TaskAccessService,
    private readonly taskMapper: TaskMapperService,
  ) {
    this.logger = new AppLogger(TaskCommentsService.name, requestContext);
  }

  /** @inheritdoc */
  public async createComment(
    taskId: string,
    dto: CreateTaskCommentDto,
  ): Promise<TaskCommentResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`createComment — start | taskId: ${taskId}`);

    const task = await this.uow.tasks.findOne({
      where: { id: taskId },
      relations: { project: true },
    });
    if (!task) {
      throw this.taskAccess.taskNotFound(taskId);
    }

    await this.verifyCommentAccess(task.project.businessId, task.projectId);

    const comment = this.uow.taskComments.create({
      taskId,
      authorId: userId,
      body: dto.body,
    });
    const saved = await this.uow.taskComments.save(comment);

    this.logger.log(`createComment — complete | commentId: ${saved.id}, taskId: ${taskId}`);
    return this.taskMapper.toTaskCommentResponseDto(saved);
  }

  /** @inheritdoc */
  public async listComments(
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskCommentResponseDto>> {
    const [comments, itemCount] = await this.uow.taskComments.findAndCount({
      where: { taskId, isDeleted: false },
      skip: pageOptions.skip,
      take: pageOptions.limit,
      order: { createdAt: 'ASC' },
    });

    const data = comments.map((c) => this.taskMapper.toTaskCommentResponseDto(c));
    const meta = new PageMetaDto({ pageOptionsDto: pageOptions, itemCount });
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async updateComment(
    commentId: string,
    dto: UpdateTaskCommentDto,
  ): Promise<TaskCommentResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`updateComment — start | commentId: ${commentId}`);

    const comment = await this.uow.taskComments.findOne({ where: { id: commentId } });
    if (!comment || comment.isDeleted) {
      throw this.commentNotFound(commentId);
    }

    if (comment.authorId !== userId) {
      throw new TranslatableException({
        messageKey: TASK_ERRORS.COMMENT_FORBIDDEN,
        errorCode: ERROR_CODES.TASK_COMMENT_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    }

    comment.body = dto.body;
    comment.isEdited = true;
    comment.editedAt = new Date();
    const saved = await this.uow.taskComments.save(comment);

    this.logger.log(`updateComment — complete | commentId: ${commentId}`);
    return this.taskMapper.toTaskCommentResponseDto(saved);
  }

  /** @inheritdoc */
  public async deleteComment(commentId: string): Promise<void> {
    const userId = this.requestContext.userId!;
    this.logger.log(`deleteComment — start | commentId: ${commentId}`);

    const comment = await this.uow.taskComments.findOne({ where: { id: commentId } });
    if (!comment || comment.isDeleted) {
      throw this.commentNotFound(commentId);
    }

    if (comment.authorId !== userId) {
      throw new TranslatableException({
        messageKey: TASK_ERRORS.COMMENT_FORBIDDEN,
        errorCode: ERROR_CODES.TASK_COMMENT_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    }

    comment.isDeleted = true;
    await this.uow.taskComments.save(comment);

    this.logger.log(`deleteComment — complete | commentId: ${commentId}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Verifies the caller is either the project owner (business) or an ACTIVE
   * project member (consultant).
   */
  private async verifyCommentAccess(businessId: string, projectId: string): Promise<void> {
    const userId = this.requestContext.userId!;

    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (businessProfile && businessProfile.id === businessId) {
      return;
    }

    const consultantProfile = await this.uow.consultantProfiles.findByUserId(userId);
    if (consultantProfile) {
      const member = await this.uow.projectMembers.findOne({
        where: {
          projectId,
          consultantId: consultantProfile.id,
          status: ProjectMemberStatus.ACTIVE,
        },
      });
      if (member) return;
    }

    throw new TranslatableException({
      messageKey: TASK_ERRORS.COMMENT_FORBIDDEN,
      errorCode: ERROR_CODES.TASK_COMMENT_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    });
  }

  private commentNotFound(commentId: string): TranslatableException {
    this.logger.warn(`comment operation — comment not found | commentId: ${commentId}`);
    return new TranslatableException({
      messageKey: TASK_ERRORS.COMMENT_NOT_FOUND,
      errorCode: ERROR_CODES.TASK_COMMENT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }
}
