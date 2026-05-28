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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ListPendingReviewsDto } from '@plys/libraries/api-contracts/task-reviews/dto/requests/list-pending-reviews.dto';
import { SubmitVoteDto } from '@plys/libraries/api-contracts/task-reviews/dto/requests/submit-vote.dto';
import { TaskReviewDetailResponseDto } from '@plys/libraries/api-contracts/task-reviews/dto/responses/task-review-detail-response.dto';
import { TaskReviewResponseDto } from '@plys/libraries/api-contracts/task-reviews/dto/responses/task-review-response.dto';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import {
  TaskReviewQueryService,
  TaskReviewVotingService,
} from '@/http/v1/shared/grpc-service-tokens';

/**
 * Admin-platform endpoints used by both ADMIN_PLATFORM users (oversight) and
 * TASK_REVIEWER users (actual voting). The voting endpoint additionally checks
 * that the caller's userId matches the `task_reviews.reviewer_id` so admins
 * can read every review but only the assigned reviewer can submit a vote.
 */
@ApiTags('Admin - Task Reviews')
@ApiBearerAuth()
@Controller('admin/task-reviews')
@Roles(UserRole.ADMIN_PLATFORM, UserRole.TASK_REVIEWER)
@Throttle(THROTTLE_DEFAULT)
export class TaskReviewsController {
  constructor(
    private readonly query: TaskReviewQueryService,
    private readonly voting: TaskReviewVotingService,
  ) {}

  @Get('pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List the caller’s pending review assignments (Reviewer / Admin)',
    description:
      'Returns reviews currently in `pending` decision assigned to the caller. ' +
      'Admin callers see an empty page unless they were also assigned reviews via ' +
      'a transition during the test seeding.',
  })
  public async listPending(
    @Query() filters: ListPendingReviewsDto,
  ): Promise<ITranslatedPayload<PageDto<TaskReviewResponseDto>>> {
    const data = await this.query.listPending(filters);
    return { messageKey: 'success.ok', data };
  }

  @Get(':reviewId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch one review with task context (Reviewer / Admin)',
    description:
      'Reviewers may only read reviews assigned to them; ADMIN_PLATFORM may read ' +
      'any review row for oversight purposes.',
  })
  public async getDetail(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ): Promise<ITranslatedPayload<TaskReviewDetailResponseDto>> {
    const data = await this.query.getDetail(reviewId);
    return { messageKey: 'success.ok', data };
  }

  @Post(':reviewId/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cast a PASS / FAIL vote (Reviewer)',
    description:
      'Records the caller’s vote and re-evaluates the 3+1 round. Only the ' +
      'assigned reviewer (matched by `task_reviews.reviewer_id` = caller id) ' +
      'may submit a vote; ADMIN_PLATFORM callers receive 403.',
  })
  public async vote(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SubmitVoteDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.voting.submitVote(reviewId, dto);
    return { messageKey: 'success.ok', data: null };
  }
}
