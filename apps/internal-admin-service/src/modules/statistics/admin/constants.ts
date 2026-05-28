/**
 * Cache keys used by the admin dashboard services. Version suffix lets us
 * roll the response shape without flushing Redis manually — bump the suffix
 * when a breaking change ships.
 */
export const ADMIN_DASHBOARD_CACHE_KEYS = {
  SUMMARY: 'admin:dashboard:summary:v1',
  QUEUES: 'admin:dashboard:queues:v1',
} as const;

/**
 * TTL (seconds) applied to the cached summary + queues payloads. Short
 * enough that staleness is bounded, long enough to absorb a burst of admin
 * SPA loads without hitting the DB every time.
 */
export const ADMIN_DASHBOARD_CACHE_TTL_SECONDS = 60;
