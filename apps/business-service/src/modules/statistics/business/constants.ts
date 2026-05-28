// Per-business cache keys for the business dashboard. Key includes
// `businessId` so two different businesses never share a cached payload —
// critical for security since the summary embeds the wallet balance.
//
// `v1` suffix lets us roll the response shape without flushing Redis manually:
// bump the suffix and the next request lands on a fresh key.
export const BUSINESS_DASHBOARD_CACHE_KEYS = {
  summary: (businessId: string): string => `business:dashboard:summary:${businessId}:v1`,
  actionItems: (businessId: string): string => `business:dashboard:action_items:${businessId}:v1`,
} as const;

export const BUSINESS_DASHBOARD_CACHE_TTL_SECONDS = {
  summary: 60,
  actionItems: 30,
} as const;

/** Top-N cap for each category in the action-items endpoint. */
export const BUSINESS_DASHBOARD_ACTION_ITEMS_LIMIT = 5;
