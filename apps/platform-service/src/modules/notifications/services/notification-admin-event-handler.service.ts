import { Injectable } from '@nestjs/common';
import {
  IBusinessOnboardedEvent,
  IConsultantOnboardingSubmittedEvent,
  IConsultantProjectJoinedEvent,
  IConsultantProjectLeftEvent,
  IPaymentTopUpCompletedEvent,
  IProjectPublishedEvent,
  ITaskPublishedEvent,
} from '@plys/libraries/common-nest/events';

import { NOTIFICATION_TYPES } from '../enums/notification-type.enum';
import { IAdminNotificationEventHandlerService } from '../interfaces/notification-event-handler-admin.interface';
import { NotificationEventSharedService } from './notification-event-shared.service';

@Injectable()
export class NotificationAdminEventHandlerService implements IAdminNotificationEventHandlerService {
  constructor(private readonly shared: NotificationEventSharedService) {}

  /** @inheritdoc */
  public async onBusinessOnboarded(event: IBusinessOnboardedEvent): Promise<void> {
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_BUSINESS_ONBOARDED, {
      business_id: event.business_id,
      business_name: event.business_name,
    });
  }

  /** @inheritdoc */
  public async onAdminProjectPublished(event: IProjectPublishedEvent): Promise<void> {
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_PROJECT_PUBLISHED, {
      project_id: event.project_id,
      project_code: event.project_code,
      project_title: event.project_title,
      business_id: event.business_id,
      business_name: event.business_name,
    });
  }

  /** @inheritdoc */
  public async onAdminBusinessTopUp(event: IPaymentTopUpCompletedEvent): Promise<void> {
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_BUSINESS_TOP_UP, {
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
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_TASK_PUBLISHED, {
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
    await this.shared.dispatchToAllAdmins(
      NOTIFICATION_TYPES.ADMIN_CONSULTANT_ONBOARDING_SUBMITTED,
      {
        onboarding_id: event.onboarding_id,
        consultant_user_id: event.consultant_user_id,
        consultant_name: event.consultant_name,
      },
    );
  }

  /** @inheritdoc */
  public async onAdminConsultantProjectJoined(event: IConsultantProjectJoinedEvent): Promise<void> {
    const businessName = await this.shared.resolveBusinessName(event.business_id);
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_JOINED, {
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
    const businessName = await this.shared.resolveBusinessName(event.business_id);
    await this.shared.dispatchToAllAdmins(NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_LEFT, {
      consultant_user_id: event.consultant_user_id,
      consultant_name: event.consultant_name,
      project_id: event.project_id,
      project_code: event.project_code,
      project_title: event.project_title,
      business_id: event.business_id,
      business_name: businessName,
    });
  }
}
