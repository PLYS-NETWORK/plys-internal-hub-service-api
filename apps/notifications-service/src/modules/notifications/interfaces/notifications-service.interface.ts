import { ListNotificationsDto } from '../dto/requests';
import {
  MarkAllReadResponseDto,
  NotificationCursorPageDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from '../dto/responses';

export interface INotificationsService {
  /**
   * Lists the caller's notifications, ordered by created_at DESC. Cursor-based
   * keyset pagination on `(created_at, id)` for stable scroll without OFFSET.
   * @param dto Query — cursor (opaque base64 of {created_at, id}), take, optional unread filter.
   * @returns Page of `NotificationResponseDto` plus `next_cursor` and `has_more`.
   */
  listMine(dto: ListNotificationsDto): Promise<NotificationCursorPageDto>;

  /**
   * Returns the caller's unread count. Tries the Redis cache first; on miss,
   * issues a single COUNT(*) over the partial unread index and caches the result.
   * @returns `{ unread_count: number }`.
   */
  getUnreadCount(): Promise<UnreadCountResponseDto>;

  /**
   * Marks a single notification as read. Idempotent — repeat calls return the
   * row unchanged. The unread-count cache is decremented only on the first
   * false→true transition.
   * @param notificationId The notification to mark.
   * @returns The (now-read) notification row, projected as `NotificationResponseDto`.
   * @throws TranslatableException 404 NOTIFICATION_NOT_FOUND when the row does not exist or does not belong to the caller.
   */
  markRead(notificationId: string): Promise<NotificationResponseDto>;

  /**
   * Marks every unread notification for the caller as read in a single UPDATE.
   * The unread-count cache is invalidated.
   * @returns `{ updated_count: number }` — how many rows transitioned from unread to read.
   */
  markAllRead(): Promise<MarkAllReadResponseDto>;
}
