import { Injectable } from '@nestjs/common';
import {
  IConsultantProjectJoinedEvent,
  IConsultantProjectLeftEvent,
  IPaymentTopUpCompletedEvent,
  IPaymentTopUpRefundedEvent,
  IPaymentWithdrawCompletedEvent,
  IPaymentWithdrawReversedEvent,
  IProjectPublishedEvent,
  IProjectUnpublishedEvent,
  ITaskPublishedEvent,
  ITaskStatusChangedEvent,
} from '@plys/libraries/common-nest/events';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

import { NOTIFICATION_TYPES } from '../enums/notification-type.enum';
import { IBusinessNotificationEventHandlerService } from '../interfaces/notification-event-handler-business.interface';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationEventSharedService } from './notification-event-shared.service';

@Injectable()
export class NotificationBusinessEventHandlerService implements IBusinessNotificationEventHandlerService {
  private readonly logger: AppLogger;

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly shared: NotificationEventSharedService,
    requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationBusinessEventHandlerService.name, requestContext);
  }

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
          `[${this.shared.rid}] onBusinessProjectPublished — failed | projectId: ${event.project_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onBusinessProjectUnpublished — failed | projectId: ${event.project_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onBusinessTaskPublished — failed | taskId: ${event.task_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onPaymentTopUpCompleted — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onPaymentTopUpRefunded — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onPaymentWithdrawCompleted — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onPaymentWithdrawReversed — failed | txId: ${event.transaction_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onBusinessProjectConsultantJoined — failed | projectId: ${event.project_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onBusinessProjectConsultantLeft — failed | projectId: ${event.project_id} | error: ${String(err)}`,
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
          `[${this.shared.rid}] onBusinessTaskStatusChanged — failed | taskId: ${event.task_id} | error: ${String(err)}`,
        ),
      );
  }
}
