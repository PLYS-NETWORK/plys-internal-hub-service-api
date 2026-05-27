/** WebSocket connection limits for the notifications gateway. */
export interface IWebSocketConfig {
  /** Max concurrent sockets per user (multi-tab); oldest disconnected when exceeded. */
  readonly wsMaxConnectionsPerUser: number;

  /** Max WS handshake attempts per client IP per minute. */
  readonly wsConnectRateLimitPerMinute: number;
}
