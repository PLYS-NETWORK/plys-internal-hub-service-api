import { NotificationType } from '../enums/notification-type.enum';
import { NotificationMetadataMap } from '../types/notification-metadata.types';

export interface IDispatchInput<T extends NotificationType> {
  /** Recipient userId — for trigger #5 (new application) this is the project owner, NOT the actor. */
  readonly userId: string;
  readonly type: T;
  /** Type-checked against the discriminator — wrong shape is a compile error. */
  readonly metadata: NotificationMetadataMap[T];
  /** Who caused the event. Null for webhook-driven and user-self actions. */
  readonly actorId?: string | null;
  /** Override the auto-computed redirect URL. Rarely needed. */
  readonly redirectUrlOverride?: string;
}

export interface INotificationDispatcherService {
  /**
   * Persists a notification row, pushes it to Redis pub/sub, and best-effort
   * increments the unread-count cache. Designed as fire-and-forget — callers
   * should `.catch()` log errors and never `await` the promise on the request
   * critical path. Errors are caught internally and never thrown to the caller.
   *
   * @param input Dispatch input — recipient userId, discriminator, typed metadata.
   * @returns The created notification ID, or `null` when persistence failed.
   * @throws Never — every error is logged and swallowed; `null` indicates failure.
   */
  dispatch<T extends NotificationType>(input: IDispatchInput<T>): Promise<string | null>;
}
