import { createHash } from 'crypto';

/**
 * Returns the SHA-256 hex digest of the given input string.
 * Only hashes are persisted in the DB — raw tokens are sent to users and
 * discarded so a database breach never exposes usable credentials.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Converts a duration string (e.g. '15m', '1h', '7d') to milliseconds.
 * Supported units: s (seconds), m (minutes), h (hours), d (days).
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60 * 1_000,
    h: 60 * 60 * 1_000,
    d: 24 * 60 * 60 * 1_000,
  };

  return value * multipliers[unit];
}
