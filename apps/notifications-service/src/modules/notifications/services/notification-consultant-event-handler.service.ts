import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import {
  IConsultantAccountBannedEvent,
  IConsultantOnboardingApprovedEvent,
  IConsultantOnboardingRejectedEvent,
  IConsultantProjectJoinedEvent,
  IConsultantSkillExamFailedEvent,
  IConsultantSkillExamPassedEvent,
  IConsultantSkillExamSubmittedEvent,
  IProjectPublishedEvent,
  ITaskStatusChangedEvent,
} from '@plys/libraries/common-nest/events';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { Queue } from 'bull';

import { NOTIFICATION_TYPES } from '../enums/notification-type.enum';
import { IConsultantNotificationEventHandlerService } from '../interfaces/notification-event-handler-consultant.interface';
import {
  ISkillMatchJobPayload,
  SKILL_MATCH_NOTIFICATION_JOBS,
  SKILL_MATCH_NOTIFICATION_QUEUE,
} from '../queues/skill-match-notification.constants';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationEventSharedService } from './notification-event-shared.service';

@Injectable()
export class NotificationConsultantEventHandlerService implements IConsultantNotificationEventHandlerService {
  private readonly logger: AppLogger;

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly shared: NotificationEventSharedService,
    private readonly uow: UnitOfWorkService,
    @InjectQueue(SKILL_MATCH_NOTIFICATION_QUEUE)
    private readonly skillMatchQueue: Queue<ISkillMatchJobPayload>,
    requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationConsultantEventHandlerService.name, requestContext);
  }

  /** @inheritdoc */
  public async onConsultantProjectSkillMatch(event: IProjectPublishedEvent): Promise<void> {
    if (event.required_skill_ids.length === 0) return;
    try {
      await this.skillMatchQueue.add(SKILL_MATCH_NOTIFICATION_JOBS.DISPATCH_MATCHING_CONSULTANTS, {
        project_id: event.project_id,
        project_code: event.project_code,
        project_title: event.project_title,
        business_id: event.business_id,
        required_skill_ids: event.required_skill_ids,
      });
      this.logger.log(
        `[${this.shared.rid}] onConsultantProjectSkillMatch — job enqueued | projectId: ${event.project_id}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[${this.shared.rid}] onConsultantProjectSkillMatch — enqueue failed | projectId: ${event.project_id} | error: ${String(err)}`,
      );
    }
  }

  /** @inheritdoc */
  public async onConsultantProjectJoined(event: IConsultantProjectJoinedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_PROJECT_JOINED,
        metadata: {
          project_id: event.project_id,
          project_code: event.project_code,
          project_title: event.project_title,
          business_id: event.business_id,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantProjectJoined — failed | projectId: ${event.project_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onConsultantTaskStatusChanged(event: ITaskStatusChangedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_TASK_STATUS_CHANGED,
        metadata: {
          task_id: event.task_id,
          task_code: event.task_code,
          task_title: event.task_title,
          project_id: event.project_id,
          old_status: event.old_status,
          new_status: event.new_status,
          // Review-workflow enrichment — surfaced on DONE / REVISION_REQUESTED.
          earned_amount: event.earned_amount,
          feedback_summary: event.feedback_summary,
          revision_count: event.revision_count,
          revisions_remaining: event.revisions_remaining,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantTaskStatusChanged — failed | taskId: ${event.task_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onConsultantOnboardingApproved(
    event: IConsultantOnboardingApprovedEvent,
  ): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_ONBOARDING_APPROVED,
        metadata: { onboarding_id: event.onboarding_id },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantOnboardingApproved — failed | userId: ${event.consultant_user_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onConsultantOnboardingRejected(
    event: IConsultantOnboardingRejectedEvent,
  ): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_ONBOARDING_REJECTED,
        metadata: {
          onboarding_id: event.onboarding_id,
          blocked_until: event.blocked_until,
          rejection_note: event.rejection_note,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantOnboardingRejected — failed | userId: ${event.consultant_user_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onConsultantSkillExamSubmitted(
    event: IConsultantSkillExamSubmittedEvent,
  ): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_SUBMITTED,
        metadata: {
          exam_id: event.exam_id,
          skill_id: event.skill_id,
          skill_name: event.skill_name,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantSkillExamSubmitted — failed | examId: ${event.exam_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onConsultantSkillExamFailed(event: IConsultantSkillExamFailedEvent): Promise<void> {
    // Consultant-side notification first.
    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_FAILED,
        metadata: {
          exam_id: event.exam_id,
          skill_id: event.skill_id,
          skill_name: event.skill_name,
          fail_reason: event.fail_reason,
          final_score: event.final_score,
          cooldown_until: event.cooldown_until,
          strike_count: event.strike_count,
          strikes_remaining: Math.max(0, 3 - event.strike_count),
          assigned_proficiency: event.assigned_proficiency,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantSkillExamFailed — failed | examId: ${event.exam_id} | error: ${String(err)}`,
        ),
      );

    // Admin fan-out — every reviewer sees terminal outcomes in real time.
    const consultantName = await this.shared.resolveConsultantName(event.consultant_user_id);
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_SKILL_EXAM_RESULT, {
      outcome: event.fail_reason,
      exam_id: event.exam_id,
      consultant_user_id: event.consultant_user_id,
      consultant_name: consultantName,
      skill_id: event.skill_id,
      skill_name: event.skill_name,
      final_score: event.final_score,
      cooldown_until: event.cooldown_until,
      strike_count: event.strike_count,
      assigned_proficiency: event.assigned_proficiency,
    });
  }

  /** @inheritdoc */
  public async onConsultantSkillExamPassed(event: IConsultantSkillExamPassedEvent): Promise<void> {
    // hasNotificationPriority is keyed off the consultant's avgRating (not the
    // individual exam), so look it up rather than infer from the exam tier.
    const profile = await this.uow.consultantProfiles.findByUserId(event.consultant_user_id);
    const hasPriorityBenefit = profile?.hasNotificationPriority ?? false;

    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_PASSED,
        metadata: {
          exam_id: event.exam_id,
          skill_id: event.skill_id,
          skill_name: event.skill_name,
          final_score: event.final_score,
          proficiency_level: event.proficiency_level,
          has_priority_benefit: hasPriorityBenefit,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantSkillExamPassed — failed | examId: ${event.exam_id} | error: ${String(err)}`,
        ),
      );

    const consultantName = await this.shared.resolveConsultantName(event.consultant_user_id);
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_SKILL_EXAM_RESULT, {
      outcome: 'PASSED',
      exam_id: event.exam_id,
      consultant_user_id: event.consultant_user_id,
      consultant_name: consultantName,
      skill_id: event.skill_id,
      skill_name: event.skill_name,
      final_score: event.final_score,
      proficiency_level: event.proficiency_level,
    });
  }

  /** @inheritdoc */
  public async onConsultantAccountBanned(event: IConsultantAccountBannedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.consultant_user_id,
        type: NOTIFICATION_TYPES.CONSULTANT_ACCOUNT_BANNED,
        metadata: { ban_reason: event.ban_reason, banned_at: event.banned_at },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onConsultantAccountBanned — failed | userId: ${event.consultant_user_id} | error: ${String(err)}`,
        ),
      );

    const consultantName = await this.shared.resolveConsultantName(event.consultant_user_id);
    const user = await this.uow.users.findById(event.consultant_user_id);
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_BANNED, {
      consultant_user_id: event.consultant_user_id,
      consultant_name: consultantName,
      ban_reason: event.ban_reason,
      banned_at: event.banned_at,
      ai_strike_count: user?.aiStrikeCount ?? 0,
    });
  }
}
