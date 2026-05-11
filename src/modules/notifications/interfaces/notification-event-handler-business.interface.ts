import {
  IPaymentTopUpCompletedEvent,
  IPaymentTopUpRefundedEvent,
  IPaymentWithdrawCompletedEvent,
  IPaymentWithdrawReversedEvent,
  IProjectPublishedEvent,
  IProjectUnpublishedEvent,
  ITaskPublishedEvent,
} from '@common/events';

export interface IBusinessNotificationEventHandlerService {
  /**
   * Sends `PROJECT_PUBLISHED` to the owning business user when their project
   * transitions to a public status.
   * @param event Payload carrying project identity and the business owner's userId.
   */
  onBusinessProjectPublished(event: IProjectPublishedEvent): Promise<void>;

  /**
   * Sends `PROJECT_UNPUBLISHED` to the owning business user when their project
   * is taken offline.
   * @param event Payload including an optional refund amount if the project was pre-paid.
   */
  onBusinessProjectUnpublished(event: IProjectUnpublishedEvent): Promise<void>;

  /**
   * Sends `TASK_PUBLISHED` to the owning business user when a task inside
   * their project is published.
   * @param event Payload carrying task and project identity.
   */
  onBusinessTaskPublished(event: ITaskPublishedEvent): Promise<void>;

  /**
   * Sends `TOP_UP_COMPLETED` to the business user when their top-up is
   * successfully processed.
   * @param event Payload carrying transaction amount, currency, and new balance.
   */
  onPaymentTopUpCompleted(event: IPaymentTopUpCompletedEvent): Promise<void>;

  /**
   * Sends `TOP_UP_REFUNDED` to the business user when a previously completed
   * top-up is cancelled and refunded.
   * @param event Payload carrying original transaction details and refunded amount.
   */
  onPaymentTopUpRefunded(event: IPaymentTopUpRefundedEvent): Promise<void>;

  /**
   * Sends `WITHDRAW_COMPLETED` to the user (business or consultant) when a
   * withdrawal request is successfully processed.
   * @param event Payload carrying transaction details and updated balance.
   */
  onPaymentWithdrawCompleted(event: IPaymentWithdrawCompletedEvent): Promise<void>;

  /**
   * Sends `WITHDRAW_REVERSED` to the user when a withdrawal is reversed or
   * rejected after processing.
   * @param event Payload extending the completed event with a reversal reason.
   */
  onPaymentWithdrawReversed(event: IPaymentWithdrawReversedEvent): Promise<void>;
}
