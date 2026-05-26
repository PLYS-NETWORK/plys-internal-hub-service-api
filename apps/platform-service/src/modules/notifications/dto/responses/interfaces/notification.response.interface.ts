// Snake-case JSON contract — also the runtime shape of the live `notification.new`
// Socket.IO event. Frontend imports the discriminated-union `NotificationPayload`
// from src/modules/notifications/types/notification-metadata.types.ts for type-safe
// per-`type` narrowing of the `metadata` field.
export interface INotificationResponse {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly metadata: Record<string, unknown>;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly redirect_url: string | null;
  readonly is_read: boolean;
  readonly read_at: string | null;
  readonly created_at: string;
  readonly actor_id: string | null;
}
