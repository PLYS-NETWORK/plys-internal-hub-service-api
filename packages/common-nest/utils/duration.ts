/**
 * Formatted worked-duration shape returned from board responses.
 * - `total_seconds` is always present so callers can sort or recompute.
 * - `days` is omitted when the duration is below 24h.
 * - `hours` is the integer remainder of hours (0–23) when `days` is set,
 *   or the floor of total hours otherwise.
 */
export interface IFormattedDuration {
  days?: number;
  hours: number;
  total_seconds: number;
}

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/**
 * Convert a duration in seconds into a `{ days?, hours, total_seconds }`
 * payload suitable for the board's `total_time_worked` field.
 *
 * Rule per spec:
 *   - < 24h  → return hours only
 *   - >= 24h → return days + remainder hours
 */
export function formatWorkedDuration(totalSeconds: number): IFormattedDuration {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;

  if (safe < SECONDS_PER_DAY) {
    return {
      hours: Math.floor(safe / SECONDS_PER_HOUR),
      total_seconds: safe,
    };
  }

  return {
    days: Math.floor(safe / SECONDS_PER_DAY),
    hours: Math.floor((safe % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    total_seconds: safe,
  };
}

/**
 * Compute the "total worked seconds" from a task's started_at / completed_at:
 *   - Both null → 0
 *   - started_at only → now - started_at (task is in flight)
 *   - both set → completed_at - started_at
 */
export function computeWorkedSeconds(
  startedAt: Date | string | null | undefined,
  completedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!startedAt) return 0;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const end = completedAt
    ? completedAt instanceof Date
      ? completedAt
      : new Date(completedAt)
    : now;
  const ms = end.getTime() - start.getTime();
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}
