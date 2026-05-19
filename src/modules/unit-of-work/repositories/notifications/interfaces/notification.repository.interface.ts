import { AbstractRepository } from '@common/repositories';
import { Notification } from '@database/entities';

export interface IListByUserCursorInput {
  userId: string;
  /** Decoded cursor `{ created_at, id }` — pass undefined for the first page. */
  cursor?: { createdAt: Date; id: string };
  /** Page size, server caps at 50. */
  take: number;
  /** When true, restrict to is_read=false. */
  unreadOnly?: boolean;
}

export interface INotificationRepository extends AbstractRepository<Notification> {
  /**
   * Cursor-paginated list of one user's notifications.
   * Always orders by (created_at DESC, id DESC) — keyset on the composite index
   * `idx_notifications_user_created`. Returns up to `take + 1` rows so the caller
   * can detect whether a next page exists.
   * @param input Recipient userId, cursor, take, and optional unread filter.
   * @returns Up to `take + 1` rows; caller slices to `take` and uses the extra row to compute `has_more`.
   */
  listByUserCursor(input: IListByUserCursorInput): Promise<Notification[]>;

  /**
   * Counts unread rows for a user. Backed by partial index `idx_notifications_user_unread`.
   * @param userId Recipient userId.
   * @returns Number of unread notifications.
   */
  countUnreadByUserId(userId: string): Promise<number>;

  /**
   * Marks one notification as read for a given user. Idempotent.
   * @param userId Recipient userId — required because the row may not belong to the caller.
   * @param notificationId The notification to mark.
   * @returns `true` when the row transitioned from unread to read; `false` when already read or not found.
   */
  markRead(userId: string, notificationId: string): Promise<boolean>;

  /**
   * Marks every unread notification for a user as read in a single UPDATE.
   * @param userId Recipient userId.
   * @returns The number of rows that transitioned from unread to read.
   */
  markAllRead(userId: string): Promise<number>;

  /**
   * Returns the most recent unread notifications for a user, capped at
   * `limit`. Sorted by (`created_at` DESC, `id` DESC) — same ordering as the
   * cursor list but without pagination. Used by the consultant dashboard
   * action-items endpoint's `recent_notifications` category.
   */
  findRecentUnreadByUserId(userId: string, limit: number): Promise<Notification[]>;
}
