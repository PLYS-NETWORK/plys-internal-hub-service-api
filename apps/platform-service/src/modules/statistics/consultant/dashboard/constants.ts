// Per-consultant cache keys for the consultant dashboard. Key includes
// `consultantId` so two different consultants never share a cached payload —
// critical for security since the summary embeds the wallet balance.
//
// `v1` suffix lets us roll the response shape without flushing Redis manually.
export const CONSULTANT_DASHBOARD_CACHE_KEYS = {
  summary: (consultantId: string): string => `consultant:dashboard:summary:${consultantId}:v1`,
  actionItems: (consultantId: string): string =>
    `consultant:dashboard:action_items:${consultantId}:v1`,
} as const;

export const CONSULTANT_DASHBOARD_CACHE_TTL_SECONDS = {
  summary: 60,
  actionItems: 30,
} as const;

/** Top-N cap for each category in the action-items endpoint. */
export const CONSULTANT_DASHBOARD_ACTION_ITEMS_LIMIT = 5;
