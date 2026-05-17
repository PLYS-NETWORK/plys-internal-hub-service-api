import {
  IBusinessOnboardedEvent,
  IConsultantAccountBannedEvent,
  IConsultantOnboardingApprovedEvent,
  IConsultantOnboardingRejectedEvent,
  IConsultantOnboardingSubmittedEvent,
  IConsultantProjectJoinedEvent,
  IConsultantProjectLeftEvent,
  IConsultantSkillExamFailedEvent,
  IConsultantSkillExamPassedEvent,
  IConsultantSkillExamSubmittedEvent,
  IPaymentTopUpCompletedEvent,
  IPaymentTopUpRefundedEvent,
  IPaymentWithdrawCompletedEvent,
  IPaymentWithdrawReversedEvent,
  IProjectPublishedEvent,
  IProjectUnpublishedEvent,
  ITaskPublishedEvent,
  ITaskStatusChangedEvent,
  NOTIFICATION_EVENTS,
} from '@common/events';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bull';

import { NOTIFICATION_TYPES } from '../enums/notification-type.enum';
import { INotificationEventHandlerService } from '../interfaces/notification-event-handler.interface';
import {
  ISkillMatchJobPayload,
  SKILL_MATCH_NOTIFICATION_JOBS,
  SKILL_MATCH_NOTIFICATION_QUEUE,
} from '../queues/skill-match-notification.constants';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Injectable()
export class NotificationEventHandlerService implements INotificationEventHandlerService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    @InjectQueue(SKILL_MATCH_NOTIFICATION_QUEUE)
    private readonly skillMatchQueue: Queue<ISkillMatchJobPayload>,
  ) {
    this.logger = new AppLogger(NotificationEventHandlerService.name, requestContext);
  }

  // ── Domain event entry points (one per domain event) ─────────────────────

  @OnEvent(NOTIFICATION_EVENTS.BUSINESS_ONBOARDED, { async: true })
  public async onBusinessOnboarded(event: IBusinessOnboardedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onBusinessOnboarded — start | businessId: ${event.business_id}`);
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_BUSINESS_ONBOARDED, {
      business_id: event.business_id,
      business_name: event.business_name,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.PROJECT_PUBLISHED, { async: true })
  public async onProjectPublished(event: IProjectPublishedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onProjectPublished — start | projectId: ${event.project_id}`);
    await Promise.allSettled([
      this.onAdminProjectPublished(event),
      this.onBusinessProjectPublished(event),
      this.onConsultantProjectSkillMatch(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.PROJECT_UNPUBLISHED, { async: true })
  public async onProjectUnpublished(event: IProjectUnpublishedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onProjectUnpublished — start | projectId: ${event.project_id}`);
    await this.onBusinessProjectUnpublished(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.TASK_PUBLISHED, { async: true })
  public async onTaskPublished(event: ITaskPublishedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onTaskPublished — start | taskId: ${event.task_id}`);
    await Promise.allSettled([
      this.onAdminTaskPublished(event),
      this.onBusinessTaskPublished(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_TOP_UP_COMPLETED, { async: true })
  public async onTopUpCompleted(event: IPaymentTopUpCompletedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onTopUpCompleted — start | transactionId: ${event.transaction_id}`,
    );
    await Promise.allSettled([
      this.onAdminBusinessTopUp(event),
      this.onPaymentTopUpCompleted(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_TOP_UP_REFUNDED, { async: true })
  public async onTopUpRefunded(event: IPaymentTopUpRefundedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onTopUpRefunded — start | transactionId: ${event.transaction_id}`,
    );
    await this.onPaymentTopUpRefunded(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_WITHDRAW_COMPLETED, { async: true })
  public async onWithdrawCompleted(event: IPaymentWithdrawCompletedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onWithdrawCompleted — start | transactionId: ${event.transaction_id}`,
    );
    await this.onPaymentWithdrawCompleted(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_WITHDRAW_REVERSED, { async: true })
  public async onWithdrawReversed(event: IPaymentWithdrawReversedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onWithdrawReversed — start | transactionId: ${event.transaction_id}`,
    );
    await this.onPaymentWithdrawReversed(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_SUBMITTED, { async: true })
  public async onOnboardingSubmitted(event: IConsultantOnboardingSubmittedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onOnboardingSubmitted — start | onboardingId: ${event.onboarding_id}`,
    );
    await this.onConsultantOnboardingSubmitted(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_REJECTED, { async: true })
  public async onOnboardingRejected(event: IConsultantOnboardingRejectedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onOnboardingRejected — start | userId: ${event.consultant_user_id}`,
    );
    await this.onConsultantOnboardingRejected(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_PROJECT_JOINED, { async: true })
  public async onProjectJoined(event: IConsultantProjectJoinedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onProjectJoined — start | consultantUserId: ${event.consultant_user_id}, projectId: ${event.project_id}`,
    );
    await Promise.allSettled([
      this.onConsultantProjectJoined(event),
      this.onBusinessProjectConsultantJoined(event),
      this.onAdminConsultantProjectJoined(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_PROJECT_LEFT, { async: true })
  public async onProjectLeft(event: IConsultantProjectLeftEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onProjectLeft — start | consultantUserId: ${event.consultant_user_id}, projectId: ${event.project_id}`,
    );
    await Promise.allSettled([
      this.onBusinessProjectConsultantLeft(event),
      this.onAdminConsultantProjectLeft(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.TASK_STATUS_CHANGED, { async: true })
  public async onTaskStatusChanged(event: ITaskStatusChangedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onTaskStatusChanged — start | taskId: ${event.task_id}`);
    await Promise.allSettled([
      this.onConsultantTaskStatusChanged(event),
      this.onBusinessTaskStatusChanged(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_APPROVED, { async: true })
  public async onOnboardingApproved(event: IConsultantOnboardingApprovedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onOnboardingApproved — start | userId: ${event.consultant_user_id}`,
    );
    await this.onConsultantOnboardingApproved(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_SUBMITTED, { async: true })
  public async onSkillExamSubmitted(event: IConsultantSkillExamSubmittedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onSkillExamSubmitted — start | examId: ${event.exam_id}`);
    await this.onConsultantSkillExamSubmitted(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, { async: true })
  public async onSkillExamFailed(event: IConsultantSkillExamFailedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onSkillExamFailed — start | examId: ${event.exam_id} | reason: ${event.fail_reason}`,
    );
    await this.onConsultantSkillExamFailed(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_PASSED, { async: true })
  public async onSkillExamPassed(event: IConsultantSkillExamPassedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onSkillExamPassed — start | examId: ${event.exam_id} | proficiency: ${event.proficiency_level}`,
    );
    await this.onConsultantSkillExamPassed(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ACCOUNT_BANNED, { async: true })
  public async onAccountBanned(event: IConsultantAccountBannedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onAccountBanned — start | userId: ${event.consultant_user_id}`);
    await this.onConsultantAccountBanned(event);
  }

  // ── Admin handlers ────────────────────────────────────────────────────────

  /** @inheritdoc */
  public async onAdminProjectPublished(event: IProjectPublishedEvent): Promise<void> {
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_PROJECT_PUBLISHED, {
      project_id: event.project_id,
      project_code: event.project_code,
      project_title: event.project_title,
      business_id: event.business_id,
      business_name: event.business_name,
    });
  }

  /** @inheritdoc */
  public async onAdminBusinessTopUp(event: IPaymentTopUpCompletedEvent): Promise<void> {
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_BUSINESS_TOP_UP, {
      transaction_id: event.transaction_id,
      transaction_number: event.transaction_number,
      business_id: event.business_id,
      business_name: event.business_name,
      amount: event.amount,
      currency: event.currency,
    });
  }

  /** @inheritdoc */
  public async onAdminTaskPublished(event: ITaskPublishedEvent): Promise<void> {
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_TASK_PUBLISHED, {
      task_id: event.task_id,
      task_code: event.task_code,
      task_title: event.task_title,
      project_id: event.project_id,
      project_code: event.project_code,
      business_name: event.business_name,
    });
  }

  /** @inheritdoc */
  public async onConsultantOnboardingSubmitted(
    event: IConsultantOnboardingSubmittedEvent,
  ): Promise<void> {
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_ONBOARDING_SUBMITTED, {
      onboarding_id: event.onboarding_id,
      consultant_user_id: event.consultant_user_id,
      consultant_name: event.consultant_name,
    });
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
          `[${this.rid}] onConsultantOnboardingRejected — failed | userId: ${event.consultant_user_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onAdminConsultantProjectJoined(event: IConsultantProjectJoinedEvent): Promise<void> {
    const businessName = await this.resolveBusinessName(event.business_id);
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_JOINED, {
      consultant_user_id: event.consultant_user_id,
      consultant_name: event.consultant_name,
      project_id: event.project_id,
      project_code: event.project_code,
      project_title: event.project_title,
      business_id: event.business_id,
      business_name: businessName,
    });
  }

  /** @inheritdoc */
  public async onAdminConsultantProjectLeft(event: IConsultantProjectLeftEvent): Promise<void> {
    const businessName = await this.resolveBusinessName(event.business_id);
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_LEFT, {
      consultant_user_id: event.consultant_user_id,
      consultant_name: event.consultant_name,
      project_id: event.project_id,
      project_code: event.project_code,
      project_title: event.project_title,
      business_id: event.business_id,
      business_name: businessName,
    });
  }

  // ── Business handlers ─────────────────────────────────────────────────────

  /** @inheritdoc */
  public async onBusinessProjectPublished(event: IProjectPublishedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.business_user_id,
        type: NOTIFICATION_TYPES.PROJECT_PUBLISHED,
        metadata: {
          project_id: event.project_id,
          project_code: event.project_code,
          project_title: event.project_title,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onBusinessProjectPublished — failed | projectId: ${event.project_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onBusinessProjectUnpublished(event: IProjectUnpublishedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.business_user_id,
        type: NOTIFICATION_TYPES.PROJECT_UNPUBLISHED,
        metadata: {
          project_id: event.project_id,
          project_code: event.project_code,
          project_title: event.project_title,
          refund_amount: event.refund_amount,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onBusinessProjectUnpublished — failed | projectId: ${event.project_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onBusinessTaskPublished(event: ITaskPublishedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.business_user_id,
        type: NOTIFICATION_TYPES.TASK_PUBLISHED,
        metadata: {
          task_id: event.task_id,
          task_code: event.task_code,
          task_title: event.task_title,
          project_id: event.project_id,
          project_code: event.project_code,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onBusinessTaskPublished — failed | taskId: ${event.task_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onPaymentTopUpCompleted(event: IPaymentTopUpCompletedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.user_id,
        type: NOTIFICATION_TYPES.TOP_UP_COMPLETED,
        metadata: {
          transaction_id: event.transaction_id,
          transaction_number: event.transaction_number,
          amount: event.amount,
          currency: event.currency,
          new_balance: event.new_balance,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onPaymentTopUpCompleted — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onPaymentTopUpRefunded(event: IPaymentTopUpRefundedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.user_id,
        type: NOTIFICATION_TYPES.TOP_UP_REFUNDED,
        metadata: {
          transaction_id: event.transaction_id,
          transaction_number: event.transaction_number,
          amount: event.amount,
          currency: event.currency,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onPaymentTopUpRefunded — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onPaymentWithdrawCompleted(event: IPaymentWithdrawCompletedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.user_id,
        type: NOTIFICATION_TYPES.WITHDRAW_COMPLETED,
        metadata: {
          transaction_id: event.transaction_id,
          transaction_number: event.transaction_number,
          amount: event.amount,
          currency: event.currency,
          new_balance: event.new_balance,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onPaymentWithdrawCompleted — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onPaymentWithdrawReversed(event: IPaymentWithdrawReversedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.user_id,
        type: NOTIFICATION_TYPES.WITHDRAW_REVERSED,
        metadata: {
          transaction_id: event.transaction_id,
          transaction_number: event.transaction_number,
          amount: event.amount,
          currency: event.currency,
          new_balance: event.new_balance,
          reason: event.reason,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onPaymentWithdrawReversed — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onBusinessProjectConsultantJoined(
    event: IConsultantProjectJoinedEvent,
  ): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.business_user_id,
        type: NOTIFICATION_TYPES.PROJECT_CONSULTANT_JOINED,
        metadata: {
          project_id: event.project_id,
          project_code: event.project_code,
          project_title: event.project_title,
          consultant_user_id: event.consultant_user_id,
          consultant_name: event.consultant_name,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onBusinessProjectConsultantJoined — failed | projectId: ${event.project_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onBusinessProjectConsultantLeft(event: IConsultantProjectLeftEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.business_user_id,
        type: NOTIFICATION_TYPES.PROJECT_CONSULTANT_LEFT,
        metadata: {
          project_id: event.project_id,
          project_code: event.project_code,
          project_title: event.project_title,
          consultant_user_id: event.consultant_user_id,
          consultant_name: event.consultant_name,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onBusinessProjectConsultantLeft — failed | projectId: ${event.project_id} | error: ${String(err)}`,
        ),
      );
  }

  // ── Consultant handlers ───────────────────────────────────────────────────

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
        `[${this.rid}] onConsultantProjectSkillMatch — job enqueued | projectId: ${event.project_id}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[${this.rid}] onConsultantProjectSkillMatch — enqueue failed | projectId: ${event.project_id} | error: ${String(err)}`,
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
          `[${this.rid}] onConsultantProjectJoined — failed | projectId: ${event.project_id} | error: ${String(err)}`,
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
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onConsultantTaskStatusChanged — failed | taskId: ${event.task_id} | error: ${String(err)}`,
        ),
      );
  }

  /** @inheritdoc */
  public async onBusinessTaskStatusChanged(event: ITaskStatusChangedEvent): Promise<void> {
    void this.dispatcher
      .dispatch({
        userId: event.business_user_id,
        type: NOTIFICATION_TYPES.BUSINESS_TASK_STATUS_CHANGED,
        metadata: {
          task_id: event.task_id,
          task_code: event.task_code,
          task_title: event.task_title,
          project_id: event.project_id,
          consultant_user_id: event.consultant_user_id,
          old_status: event.old_status,
          new_status: event.new_status,
        },
        actorId: event.consultant_user_id,
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.rid}] onBusinessTaskStatusChanged — failed | taskId: ${event.task_id} | error: ${String(err)}`,
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
          `[${this.rid}] onConsultantOnboardingApproved — failed | userId: ${event.consultant_user_id} | error: ${String(err)}`,
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
          `[${this.rid}] onConsultantSkillExamSubmitted — failed | examId: ${event.exam_id} | error: ${String(err)}`,
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
          `[${this.rid}] onConsultantSkillExamFailed — failed | examId: ${event.exam_id} | error: ${String(err)}`,
        ),
      );

    // Admin fan-out — every reviewer sees terminal outcomes in real time.
    const consultantName = await this.resolveConsultantName(event.consultant_user_id);
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_SKILL_EXAM_RESULT, {
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
          `[${this.rid}] onConsultantSkillExamPassed — failed | examId: ${event.exam_id} | error: ${String(err)}`,
        ),
      );

    const consultantName = await this.resolveConsultantName(event.consultant_user_id);
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_SKILL_EXAM_RESULT, {
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
          `[${this.rid}] onConsultantAccountBanned — failed | userId: ${event.consultant_user_id} | error: ${String(err)}`,
        ),
      );

    const consultantName = await this.resolveConsultantName(event.consultant_user_id);
    const user = await this.uow.users.findById(event.consultant_user_id);
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_BANNED, {
      consultant_user_id: event.consultant_user_id,
      consultant_name: consultantName,
      ban_reason: event.ban_reason,
      banned_at: event.banned_at,
      ai_strike_count: user?.aiStrikeCount ?? 0,
    });
  }

  private async resolveConsultantName(userId: string): Promise<string> {
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (profile?.fullName) return profile.fullName;
    const user = await this.uow.users.findById(userId);
    return user?.email ?? '';
  }

  private async resolveBusinessName(businessId: string): Promise<string> {
    const profile = await this.uow.businessProfiles.findOne({ where: { id: businessId } });
    return profile?.companyName ?? '';
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Queries all active admin user IDs and dispatches the given notification
   * concurrently using Promise.allSettled — individual dispatch failures do not
   * abort the fan-out for remaining admins.
   */
  private async dispatchToAllAdmins<
    T extends (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES],
  >(
    type: T,
    // Using `Parameters` would create a circular inference loop here; the
    // caller is responsible for passing the correct metadata shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any,
    actorId: string | null = null,
  ): Promise<void> {
    try {
      const adminUserIds = await this.uow.users.findActiveAdminUserIds();
      if (adminUserIds.length === 0) {
        this.logger.warn(`[${this.rid}] dispatchToAllAdmins — no active admins | type: ${type}`);
        return;
      }
      await Promise.allSettled(
        adminUserIds.map((userId) => this.dispatcher.dispatch({ userId, type, metadata, actorId })),
      );
      this.logger.log(
        `[${this.rid}] dispatchToAllAdmins — complete | type: ${type} | count: ${adminUserIds.length}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[${this.rid}] dispatchToAllAdmins — failed | type: ${type} | error: ${String(err)}`,
      );
    }
  }
}
