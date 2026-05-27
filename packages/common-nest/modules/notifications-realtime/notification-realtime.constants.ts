/** Socket.IO namespace for live notification delivery on api-gateway. */
export const NOTIFICATION_WS_NAMESPACE = '/ws/notifications';

/** Room prefix — full room is `user:{userId}`. */
export const NOTIFICATION_ROOM_PREFIX = 'user:';

export const NOTIFICATION_EVENT_NEW = 'notification.new';
export const NOTIFICATION_EVENT_CONNECTED = 'notification.connected';

/** Shared with platform-service unread-count cache (Redis). */
export const NOTIFICATION_UNREAD_COUNT_KEY_PREFIX = 'notif:unread:';

/** Short-lived session validation cache to skip identity gRPC on WS reconnect. */
export const WS_SESSION_VALID_KEY_PREFIX = 'ws:session:valid:';
export const WS_SESSION_VALID_TTL_SECONDS = 30;

/** Per-IP WS handshake rate limit counter. */
export const WS_CONNECT_RATE_KEY_PREFIX = 'ws:conn:rate:';
export const WS_CONNECT_RATE_WINDOW_SECONDS = 60;

export function notificationRoomForUser(userId: string): string {
  return `${NOTIFICATION_ROOM_PREFIX}${userId}`;
}
