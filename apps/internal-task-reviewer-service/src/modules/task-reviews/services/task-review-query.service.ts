import { HttpStatus, Injectable } from '@nestjs/common';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageMetaDto } from '@plys/libraries/common-nest/dto/page-meta.dto';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { TaskReview } from '@plys/libraries/database/entities';
import { UserRole } from '@plys/libraries/database/enums';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../errors/error-codes';
import { TaskReviewDetailResponseDto } from '../dto/responses/task-review-detail-response.dto';
import { TaskReviewResponseDto } from '../dto/responses/task-review-response.dto';
import { ITaskReviewQueryService } from '../interfaces/task-review-query.service.interface';

@Injectable()
export class TaskReviewQueryService implements ITaskReviewQueryService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(TaskReviewQueryService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async listPending(pageOptions: PageOptionsDto): Promise<PageDto<TaskReviewResponseDto>> {
    const reviewerId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] listPending — start | reviewerId: ${reviewerId}, page: ${pageOptions.page}, limit: ${pageOptions.limit}`,
    );

    const { rows, total } = await this.uow.taskReviews.findPendingByReviewerId(
      reviewerId,
      pageOptions.page,
      pageOptions.limit,
    );
    const data = rows.map((row) => this.toListItem(row));
    const meta = new PageMetaDto({ pageOptionsDto: pageOptions, itemCount: total });
    this.logger.log(
      `[${this.rid}] listPending — complete | returned: ${data.length}, total: ${total}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async getDetail(reviewId: string): Promise<TaskReviewDetailResponseDto> {
    const callerId = this.requestContext.userId!;
    const callerRole = this.requestContext.userRole;
    this.logger.log(`[${this.rid}] getDetail — start | reviewId: ${reviewId}`);

    const row = await this.uow.taskReviews.findByIdWithTask(reviewId);
    if (!row) {
      this.logger.warn(`[${this.rid}] getDetail — not found | reviewId: ${reviewId}`);
      throw new TranslatableException({
        messageKey: 'error.task_review.not_found',
        errorCode: ERROR_CODES.TASK_REVIEW_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // ADMIN_PLATFORM may read any review; TASK_REVIEWER may only read theirs.
    if (callerRole !== UserRole.ADMIN_PLATFORM && row.reviewerId !== callerId) {
      this.logger.warn(
        `[${this.rid}] getDetail — forbidden | reviewId: ${reviewId}, callerId: ${callerId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task_review.forbidden',
        errorCode: ERROR_CODES.TASK_REVIEW_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return this.toDetail(row);
  }

  private toListItem(row: TaskReview): TaskReviewResponseDto {
    return plainToInstance(
      TaskReviewResponseDto,
      {
        id: row.id,
        task_id: row.taskId,
        task_code: row.task?.code ?? '',
        task_title: row.task?.title ?? '',
        project_id: row.task?.projectId ?? '',
        round_number: row.roundNumber,
        is_arbiter: row.isArbiter,
        decision: row.decision,
        assigned_at: row.assignedAt,
        voted_at: row.votedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toDetail(row: TaskReview): TaskReviewDetailResponseDto {
    return plainToInstance(
      TaskReviewDetailResponseDto,
      {
        id: row.id,
        task_id: row.taskId,
        task_code: row.task?.code ?? '',
        task_title: row.task?.title ?? '',
        project_id: row.task?.projectId ?? '',
        round_number: row.roundNumber,
        is_arbiter: row.isArbiter,
        decision: row.decision,
        assigned_at: row.assignedAt,
        voted_at: row.votedAt,
        task_description: row.task?.description ?? null,
        task_price: this.formatDecimal(row.task?.price),
        task_consultant_payout: this.formatDecimal(row.task?.consultantPayout),
        task_assignee_id: row.task?.assignedTo ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  private formatDecimal(value: number | string | undefined): string {
    if (value === undefined || value === null) return '0.00';
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(numeric)) return '0.00';
    return numeric.toFixed(2);
  }
}
