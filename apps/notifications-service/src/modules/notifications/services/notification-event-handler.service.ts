import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
  ITaskReviewerReviewAssignedEvent,
  ITaskStatusChangedEvent,
  NOTIFICATION_EVENTS,
} from '@plys/libraries/common-nest/events';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

import { NOTIFICATION_TYPES } from '../enums/notification-type.enum';
import { NotificationAdminEventHandlerService } from './notification-admin-event-handler.service';
import { NotificationBusinessEventHandlerService } from './notification-business-event-handler.service';
import { NotificationConsultantEventHandlerService } from './notification-consultant-event-handler.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationEventSharedService } from './notification-event-shared.service';

@Injectable()
export class NotificationEventHandlerService {
  private readonly logger: AppLogger;

  constructor(
    private readonly adminHandler: NotificationAdminEventHandlerService,
    private readonly businessHandler: NotificationBusinessEventHandlerService,
    private readonly consultantHandler: NotificationConsultantEventHandlerService,
    private readonly shared: NotificationEventSharedService,
    private readonly dispatcher: NotificationDispatcherService,
    requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationEventHandlerService.name, requestContext);
  }

  // ── Domain event entry points (one per domain event) ─────────────────────

  @OnEvent(NOTIFICATION_EVENTS.BUSINESS_ONBOARDED, { async: true })
  public async onBusinessOnboarded(event: IBusinessOnboardedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onBusinessOnboarded — start | businessId: ${event.business_id}`,
    );
    await this.adminHandler.onBusinessOnboarded(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.PROJECT_PUBLISHED, { async: true })
  public async onProjectPublished(event: IProjectPublishedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onProjectPublished — start | projectId: ${event.project_id}`,
    );
    await Promise.allSettled([
      this.adminHandler.onAdminProjectPublished(event),
      this.businessHandler.onBusinessProjectPublished(event),
      this.consultantHandler.onConsultantProjectSkillMatch(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.PROJECT_UNPUBLISHED, { async: true })
  public async onProjectUnpublished(event: IProjectUnpublishedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onProjectUnpublished — start | projectId: ${event.project_id}`,
    );
    await this.businessHandler.onBusinessProjectUnpublished(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.TASK_PUBLISHED, { async: true })
  public async onTaskPublished(event: ITaskPublishedEvent): Promise<void> {
    this.logger.log(`[${this.shared.rid}] onTaskPublished — start | taskId: ${event.task_id}`);
    await Promise.allSettled([
      this.adminHandler.onAdminTaskPublished(event),
      this.businessHandler.onBusinessTaskPublished(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_TOP_UP_COMPLETED, { async: true })
  public async onTopUpCompleted(event: IPaymentTopUpCompletedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onTopUpCompleted — start | transactionId: ${event.transaction_id}`,
    );
    await Promise.allSettled([
      this.adminHandler.onAdminBusinessTopUp(event),
      this.businessHandler.onPaymentTopUpCompleted(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_TOP_UP_REFUNDED, { async: true })
  public async onTopUpRefunded(event: IPaymentTopUpRefundedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onTopUpRefunded — start | transactionId: ${event.transaction_id}`,
    );
    await this.businessHandler.onPaymentTopUpRefunded(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_WITHDRAW_COMPLETED, { async: true })
  public async onWithdrawCompleted(event: IPaymentWithdrawCompletedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onWithdrawCompleted — start | transactionId: ${event.transaction_id}`,
    );
    await this.businessHandler.onPaymentWithdrawCompleted(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_WITHDRAW_REVERSED, { async: true })
  public async onWithdrawReversed(event: IPaymentWithdrawReversedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onWithdrawReversed — start | transactionId: ${event.transaction_id}`,
    );
    await this.businessHandler.onPaymentWithdrawReversed(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_SUBMITTED, { async: true })
  public async onOnboardingSubmitted(event: IConsultantOnboardingSubmittedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onOnboardingSubmitted — start | onboardingId: ${event.onboarding_id}`,
    );
    await this.adminHandler.onConsultantOnboardingSubmitted(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_REJECTED, { async: true })
  public async onOnboardingRejected(event: IConsultantOnboardingRejectedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onOnboardingRejected — start | userId: ${event.consultant_user_id}`,
    );
    await this.consultantHandler.onConsultantOnboardingRejected(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_PROJECT_JOINED, { async: true })
  public async onProjectJoined(event: IConsultantProjectJoinedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onProjectJoined — start | consultantUserId: ${event.consultant_user_id}, projectId: ${event.project_id}`,
    );
    await Promise.allSettled([
      this.consultantHandler.onConsultantProjectJoined(event),
      this.businessHandler.onBusinessProjectConsultantJoined(event),
      this.adminHandler.onAdminConsultantProjectJoined(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_PROJECT_LEFT, { async: true })
  public async onProjectLeft(event: IConsultantProjectLeftEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onProjectLeft — start | consultantUserId: ${event.consultant_user_id}, projectId: ${event.project_id}`,
    );
    await Promise.allSettled([
      this.businessHandler.onBusinessProjectConsultantLeft(event),
      this.adminHandler.onAdminConsultantProjectLeft(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.TASK_STATUS_CHANGED, { async: true })
  public async onTaskStatusChanged(event: ITaskStatusChangedEvent): Promise<void> {
    this.logger.log(`[${this.shared.rid}] onTaskStatusChanged — start | taskId: ${event.task_id}`);
    await Promise.allSettled([
      this.consultantHandler.onConsultantTaskStatusChanged(event),
      this.businessHandler.onBusinessTaskStatusChanged(event),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.TASK_REVIEWER_REVIEW_ASSIGNED, { async: true })
  public async onTaskReviewerReviewAssigned(
    event: ITaskReviewerReviewAssignedEvent,
  ): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onTaskReviewerReviewAssigned — start | reviewId: ${event.review_id}`,
    );
    void this.dispatcher
      .dispatch({
        userId: event.reviewer_user_id,
        type: NOTIFICATION_TYPES.TASK_REVIEWER_REVIEW_ASSIGNED,
        metadata: {
          review_id: event.review_id,
          task_id: event.task_id,
          task_code: event.task_code,
          task_title: event.task_title,
          project_id: event.project_id,
          round_number: event.round_number,
          is_arbiter: event.is_arbiter,
        },
      })
      .catch((err: unknown) =>
        this.logger.error(
          `[${this.shared.rid}] onTaskReviewerReviewAssigned — failed | reviewId: ${event.review_id} | error: ${String(err)}`,
        ),
      );
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ONBOARDING_APPROVED, { async: true })
  public async onOnboardingApproved(event: IConsultantOnboardingApprovedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onOnboardingApproved — start | userId: ${event.consultant_user_id}`,
    );
    await this.consultantHandler.onConsultantOnboardingApproved(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_SUBMITTED, { async: true })
  public async onSkillExamSubmitted(event: IConsultantSkillExamSubmittedEvent): Promise<void> {
    this.logger.log(`[${this.shared.rid}] onSkillExamSubmitted — start | examId: ${event.exam_id}`);
    await this.consultantHandler.onConsultantSkillExamSubmitted(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, { async: true })
  public async onSkillExamFailed(event: IConsultantSkillExamFailedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onSkillExamFailed — start | examId: ${event.exam_id} | reason: ${event.fail_reason}`,
    );
    await this.consultantHandler.onConsultantSkillExamFailed(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_PASSED, { async: true })
  public async onSkillExamPassed(event: IConsultantSkillExamPassedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onSkillExamPassed — start | examId: ${event.exam_id} | proficiency: ${event.proficiency_level}`,
    );
    await this.consultantHandler.onConsultantSkillExamPassed(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_ACCOUNT_BANNED, { async: true })
  public async onAccountBanned(event: IConsultantAccountBannedEvent): Promise<void> {
    this.logger.log(
      `[${this.shared.rid}] onAccountBanned — start | userId: ${event.consultant_user_id}`,
    );
    await this.consultantHandler.onConsultantAccountBanned(event);
  }
}
