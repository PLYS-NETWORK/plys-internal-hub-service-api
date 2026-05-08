import { NOTIFICATION_TYPES, NotificationType } from '../enums/notification-type.enum';

// One metadata interface per notification type. Keys are snake_case because
// they round-trip through JSON (Redis pub/sub + Socket.IO emit) without any
// transform layer between the dispatcher and the FE.

export interface IProfileUpdatedMetadata {
  /** snake_case names of the columns that changed in this update. */
  updated_fields: string[];
}

export interface IPasswordChangedMetadata {
  device_id: string | null;
  ip_address: string;
}

export interface IProjectPublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
}

export interface IProjectUnpublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  /** Refund amount in major units; only present when the project was pre-paid. */
  refund_amount?: number;
}

export interface ITopUpCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
}

export interface IWithdrawCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
}

export interface IWithdrawReversedMetadata extends IWithdrawCompletedMetadata {
  reason: string;
}

// Mapped type binding each discriminator value to its metadata shape.
// Used by the dispatcher's generic signature so passing a wrong-shaped
// metadata for a given type is a compile error.
export type NotificationMetadataMap = {
  [NOTIFICATION_TYPES.PROFILE_UPDATED]: IProfileUpdatedMetadata;
  [NOTIFICATION_TYPES.PASSWORD_CHANGED]: IPasswordChangedMetadata;
  [NOTIFICATION_TYPES.PROJECT_PUBLISHED]: IProjectPublishedMetadata;
  [NOTIFICATION_TYPES.PROJECT_UNPUBLISHED]: IProjectUnpublishedMetadata;
  [NOTIFICATION_TYPES.TOP_UP_COMPLETED]: ITopUpCompletedMetadata;
  [NOTIFICATION_TYPES.WITHDRAW_COMPLETED]: IWithdrawCompletedMetadata;
  [NOTIFICATION_TYPES.WITHDRAW_REVERSED]: IWithdrawReversedMetadata;
};

// The discriminated-union the FE consumes — TS narrows `metadata` automatically
// when the FE switches on `n.type`.
export type NotificationPayload = {
  [K in NotificationType]: {
    id: string;
    type: K;
    title: string;
    body: string;
    metadata: NotificationMetadataMap[K];
    entity_type: string;
    entity_id: string;
    redirect_url: string | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    actor_id: string | null;
  };
}[NotificationType];
