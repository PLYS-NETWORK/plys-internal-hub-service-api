import {
  IBusinessOnboardedEvent,
  IConsultantOnboardingSubmittedEvent,
  IPaymentTopUpCompletedEvent,
  IProjectPublishedEvent,
  ITaskPublishedEvent,
} from '@common/events';

export interface IAdminNotificationEventHandlerService {
  /**
   * Fan-out `ADMIN_BUSINESS_ONBOARDED` to all active admins when a business
   * user completes the onboarding flow.
   * @param event Payload carrying business identity and display name.
   */
  onBusinessOnboarded(event: IBusinessOnboardedEvent): Promise<void>;

  /**
   * Fan-out `ADMIN_PROJECT_PUBLISHED` to all active admins when any project
   * transitions to a public status.
   * @param event Payload carrying project identity and owning business details.
   */
  onAdminProjectPublished(event: IProjectPublishedEvent): Promise<void>;

  /**
   * Fan-out `ADMIN_BUSINESS_TOP_UP` to all active admins when a business
   * successfully tops up their wallet.
   * @param event Payload carrying transaction details and business identity.
   */
  onAdminBusinessTopUp(event: IPaymentTopUpCompletedEvent): Promise<void>;

  /**
   * Fan-out `ADMIN_TASK_PUBLISHED` to all active admins when a task inside
   * any project is published.
   * @param event Payload carrying task and project identity.
   */
  onAdminTaskPublished(event: ITaskPublishedEvent): Promise<void>;

  /**
   * Fan-out `ADMIN_CONSULTANT_ONBOARDING_SUBMITTED` to all active admins when
   * a consultant finalises their onboarding interview answers. The admins
   * use this signal to pull the new onboarding into their review queue.
   * @param event Payload carrying onboarding id + consultant display name.
   */
  onConsultantOnboardingSubmitted(event: IConsultantOnboardingSubmittedEvent): Promise<void>;
}
