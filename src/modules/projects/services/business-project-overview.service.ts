import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Money } from '@common/utils/money';
import { BusinessProfile, Project } from '@database/entities';
import { ApplicationStatus, TaskKanbanStatus } from '@database/enums';
import { ActivityType, IActivityEventRow } from '@modules/unit-of-work/repositories';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ActivityFeedDto } from '../dto/requests/activity-feed.dto';
import {
  ProjectActivityFeedResponseDto,
  ProjectApplicationStatsResponseDto,
  ProjectHeaderResponseDto,
  ProjectInterviewQuestionStatsResponseDto,
  ProjectMembersOverviewResponseDto,
  ProjectTaskStatsResponseDto,
} from '../dto/responses';
import { MemberActivityStatus } from '../dto/responses/interfaces/project-member-overview.response.interface';
import { IBusinessProjectOverviewService } from '../interfaces';

const ACTIVE_THRESHOLD_HOURS = 8;
const IDLE_THRESHOLD_HOURS = 48;

@Injectable()
export class BusinessProjectOverviewService implements IBusinessProjectOverviewService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BusinessProjectOverviewService.name, requestContext);
  }

  /** @inheritdoc */
  public async getHeader(projectId: string): Promise<ProjectHeaderResponseDto> {
    this.logger.log(`getHeader — start | projectId: ${projectId}`);
    const { project, businessProfile } = await this.assertOwnership(projectId);

    const [user, payment] = await Promise.all([
      this.uow.users.findOne({ where: { id: businessProfile.userId } }),
      this.uow.businessTransactions.findLatestPublishPaymentByProjectId(projectId),
    ]);

    const ownerName = businessProfile.companyName;
    const header = {
      project_id: project.id,
      title: project.title,
      introduction: project.introduction,
      status: project.status,
      created_at: project.createdAt,
      published_at: project.publishedAt,
      updated_at: project.updatedAt,
      owner: {
        user_id: businessProfile.userId,
        full_name: ownerName,
        avatar_initials: deriveInitials(ownerName),
      },
      payment: payment
        ? {
            is_paid: true,
            amount: Money.from(payment.amount).toFixedString(),
            currency: payment.currency,
            paid_at: payment.paid_at,
          }
        : { is_paid: false, amount: null, currency: null, paid_at: null },
    };

    this.logger.log(
      `getHeader — complete | projectId: ${projectId}, paid: ${payment !== null}, owner: ${user?.id ?? 'unknown'}`,
    );

    return plainToInstance(ProjectHeaderResponseDto, header, {
      excludeExtraneousValues: true,
    });
  }

  /** @inheritdoc */
  public async getMembers(projectId: string): Promise<ProjectMembersOverviewResponseDto> {
    this.logger.log(`getMembers — start | projectId: ${projectId}`);
    await this.assertOwnership(projectId);

    const [members, pendingCount] = await Promise.all([
      this.uow.projectMembers.findActiveByProjectIdWithUser(projectId),
      this.uow.projectApplications.countByProjectIdAndStatus(projectId, ApplicationStatus.PENDING),
    ]);

    const tz = this.requestContext.timezone ?? undefined;
    const now = DateUtil.now(tz).toDate();

    const items = members.map((m) => ({
      user_id: m.user_id,
      full_name: m.full_name,
      avatar_initials: deriveInitials(m.full_name),
      joined_at: m.joined_at,
      last_active_at: m.last_login_at,
      activity_status: bucketActivityStatus(m.last_login_at, now),
    }));

    this.logger.log(
      `getMembers — complete | projectId: ${projectId}, total: ${items.length}, pending: ${pendingCount}`,
    );

    return plainToInstance(
      ProjectMembersOverviewResponseDto,
      {
        project_id: projectId,
        total_members: items.length,
        pending_approval_count: pendingCount,
        members: items,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getInterviewStats(
    projectId: string,
  ): Promise<ProjectInterviewQuestionStatsResponseDto> {
    this.logger.log(`getInterviewStats — start | projectId: ${projectId}`);
    await this.assertOwnership(projectId);

    const [rawQuestions, totalApplicants] = await Promise.all([
      this.uow.projectInterviewQuestions.findWithAnswerCountsByProjectId(projectId),
      this.uow.projectApplications.count({ where: { projectId } }),
    ]);

    const questions = rawQuestions.map((q) => {
      const skip = Math.max(totalApplicants - q.answer_count, 0);
      const completion = totalApplicants === 0 ? 0 : roundRatio(q.answer_count / totalApplicants);
      return {
        question_id: q.id,
        position: q.position,
        question_text: q.question_text,
        answer_count: q.answer_count,
        skip_count: skip,
        completion_rate: completion,
      };
    });

    const avg =
      questions.length === 0
        ? 0
        : roundRatio(questions.reduce((acc, q) => acc + q.completion_rate, 0) / questions.length);

    this.logger.log(
      `getInterviewStats — complete | projectId: ${projectId}, questions: ${questions.length}, applicants: ${totalApplicants}`,
    );

    return plainToInstance(
      ProjectInterviewQuestionStatsResponseDto,
      {
        project_id: projectId,
        total_applicants: totalApplicants,
        total_questions: questions.length,
        questions,
        avg_completion_rate: avg,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getActivity(
    projectId: string,
    query: ActivityFeedDto,
  ): Promise<ProjectActivityFeedResponseDto> {
    this.logger.log(
      `getActivity — start | projectId: ${projectId}, page: ${query.page}, page_size: ${query.pageSize}, types: ${query.types?.join(',') ?? 'all'}`,
    );
    await this.assertOwnership(projectId);

    const [rows, total] = await this.uow.projectActivity.findEventsByProjectId(
      projectId,
      query.skip,
      query.pageSize,
      query.types as ActivityType[] | undefined,
    );

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
    const events = rows.map((r) => this.toActivityEvent(r));

    this.logger.log(
      `getActivity — complete | projectId: ${projectId}, returned: ${events.length}, total: ${total}`,
    );

    return plainToInstance(
      ProjectActivityFeedResponseDto,
      {
        project_id: projectId,
        events,
        page: query.page,
        page_size: query.pageSize,
        total_events: total,
        total_pages: totalPages,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getTaskStats(projectId: string): Promise<ProjectTaskStatsResponseDto> {
    this.logger.log(`getTaskStats — start | projectId: ${projectId}`);
    await this.assertOwnership(projectId);

    const byStatus = await this.uow.tasks.countByProjectIdsGroupedByStatus([projectId], projectId);

    // total_open excludes cancelled — matches the convention from the
    // statistics module's `getTaskStats` (KPI = "active workload").
    const totalOpen = Object.entries(byStatus).reduce(
      (acc, [status, count]) => (status === TaskKanbanStatus.CANCELLED ? acc : acc + count),
      0,
    );

    this.logger.log(`getTaskStats — complete | projectId: ${projectId}, total_open: ${totalOpen}`);

    return plainToInstance(
      ProjectTaskStatsResponseDto,
      { project_id: projectId, total_open: totalOpen, by_status: byStatus },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getApplicationStats(projectId: string): Promise<ProjectApplicationStatsResponseDto> {
    this.logger.log(`getApplicationStats — start | projectId: ${projectId}`);
    await this.assertOwnership(projectId);

    const rows = await this.uow.projectApplications.countByProjectIdsGroupedByProjectAndStatus(
      [projectId],
      projectId,
    );
    const row = rows[0];

    const payload = {
      project_id: projectId,
      total_applications: row?.total_applications ?? 0,
      pending_count: row?.pending_count ?? 0,
      accepted_count: row?.approved_count ?? 0,
      rejected_count: row?.rejected_count ?? 0,
      withdrawn_count: row?.withdrawn_count ?? 0,
    };

    this.logger.log(
      `getApplicationStats — complete | projectId: ${projectId}, total: ${payload.total_applications}`,
    );

    return plainToInstance(ProjectApplicationStatsResponseDto, payload, {
      excludeExtraneousValues: true,
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Resolves the caller's `BusinessProfile` and verifies the project belongs
   * to it. Returns both so the caller can use whichever it needs.
   *
   * Throws `PROJECT_NOT_FOUND` (404) on miss — same code path as the existing
   * `BusinessProjectService.getProject`.
   */
  private async assertOwnership(
    projectId: string,
  ): Promise<{ project: Project; businessProfile: BusinessProfile }> {
    const userId = this.requestContext.userId!;
    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (!businessProfile) {
      this.logger.warn(`assertOwnership — no business profile | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessProfile.id);
    if (!project) {
      this.logger.warn(
        `assertOwnership — not found or forbidden | projectId: ${projectId}, businessId: ${businessProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return { project, businessProfile };
  }

  /**
   * Shapes a raw activity row into the DTO. Builds the `actor` object from the
   * joined user info — `null` when the underlying event has no actor (system
   * events like `application_received`, where the applicant lives in payload).
   */
  private toActivityEvent(row: IActivityEventRow): {
    event_id: string;
    event_type: string;
    occurred_at: Date;
    actor: { user_id: string; full_name: string } | null;
    payload: Record<string, unknown>;
  } {
    const actor =
      row.actor_user_id && row.actor_name
        ? { user_id: row.actor_user_id, full_name: row.actor_name }
        : null;
    return {
      event_id: row.event_id,
      event_type: row.event_type,
      occurred_at: row.occurred_at,
      actor,
      payload: row.payload,
    };
  }
}

/**
 * Bucket the most-recent-activity timestamp into one of three labels.
 * `null` (never logged in) collapses to `offline`.
 */
function bucketActivityStatus(lastActiveAt: Date | null, now: Date): MemberActivityStatus {
  if (!lastActiveAt) return 'offline';
  const hoursAgo = DateUtil.diff(now, lastActiveAt, 'hour', true);
  if (hoursAgo < ACTIVE_THRESHOLD_HOURS) return 'active';
  if (hoursAgo < IDLE_THRESHOLD_HOURS) return 'idle';
  return 'offline';
}

/**
 * Build display initials from a full name. "Nguyen Van A" → "NA",
 * "Acme Corp" → "AC", "Single" → "SI". Always uppercase, max 2 chars.
 */
function deriveInitials(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
