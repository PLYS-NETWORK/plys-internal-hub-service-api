import {
  IBusinessOnboardedEvent,
  IConsultantApplicationAiRejectedEvent,
  IConsultantInterviewSubmittedEvent,
  IConsultantProjectJoinedEvent,
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

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_INTERVIEW_SUBMITTED, { async: true })
  public async onInterviewSubmitted(event: IConsultantInterviewSubmittedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onInterviewSubmitted — start | applicationId: ${event.application_id}`,
    );
    await this.onConsultantInterviewSubmitted(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_APPLICATION_AI_REJECTED, { async: true })
  public async onApplicationAiRejected(
    event: IConsultantApplicationAiRejectedEvent,
  ): Promise<void> {
    this.logger.log(
      `[${this.rid}] onApplicationAiRejected — start | applicationId: ${event.application_id}`,
    );
    await this.onConsultantApplicationAiRejected(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONSULTANT_PROJECT_JOINED, { async: true })
  public async onProjectJoined(event: IConsultantProjectJoinedEvent): Promise<void> {
    this.logger.log(
      `[${this.rid}] onProjectJoined — start | consultantUserId: ${event.consultant_user_id}`,
    );
    await this.onConsultantProjectJoined(event);
  }

  @OnEvent(NOTIFICATION_EVENTS.TASK_STATUS_CHANGED, { async: true })
  public async onTaskStatusChanged(event: ITaskStatusChangedEvent): Promise<void> {
    this.logger.log(`[${this.rid}] onTaskStatusChanged — start | taskId: ${event.task_id}`);
    await this.onConsultantTaskStatusChanged(event);
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
  public async onConsultantInterviewSubmitted(
    event: IConsultantInterviewSubmittedEvent,
  ): Promise<void> {
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_INTERVIEW_SUBMITTED, {
      application_id: event.application_id,
      consultant_name: event.consultant_name,
    });
  }

  /** @inheritdoc */
  public async onConsultantApplicationAiRejected(
    event: IConsultantApplicationAiRejectedEvent,
  ): Promise<void> {
    await this.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_AI_REJECTED, {
      application_id: event.application_id,
      consultant_name: event.consultant_name,
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
