// Centralised date helpers backed by dayjs. All timezone arguments are
// optional — when omitted the value is interpreted in UTC. Callers that need
// "Asia/Ho_Chi_Minh" (or any IANA zone) pass the tz string and the helper
// converts the input *into* that zone before applying the operation.
//
// Why this exists: the codebase had ad-hoc `new Date().toISOString()` calls
// and the `from`/`to` query params were expanded inline inside the DTO. This
// module gives every layer one consistent way to parse, compare, format, and
// shift dates so timezone bugs don't multiply.
//
// Plugins are extended exactly once at module load — `dayjs.extend` is
// idempotent so importing this util from multiple places is safe.

import dayjs = require('dayjs');
import customParseFormat = require('dayjs/plugin/customParseFormat');
import isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
import isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
import timezone = require('dayjs/plugin/timezone');
import utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/** Anything dayjs can parse: ISO string, JS Date, epoch ms, or another dayjs instance. */
export type DateInput = string | number | Date | dayjs.Dayjs;

/**
 * Granularities supported across every helper. `quarter` is intentionally
 * omitted — dayjs requires the `quarterOfYear` plugin for it and the codebase
 * has no current need.
 */
export type DateUnit =
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

/** Alias kept for clarity at comparison sites — same set as DateUnit. */
export type CompareUnit = DateUnit;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Trailing `Z` or `±HH(:?MM)` — anything dayjs would parse as carrying its own
// timezone offset.
const TZ_INDICATOR_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/;

function hasTimezoneIndicator(value: string): boolean {
  return TZ_INDICATOR_PATTERN.test(value);
}

/**
 * Internal: parse an input into a dayjs instance.
 *
 * Behaviour:
 *  - No `tz`             → parsed as UTC.
 *  - `tz` + naive input  → interpreted as **wall-clock** in `tz`.
 *    (e.g. "2026-04-26" + "Asia/Ho_Chi_Minh" → 00:00 HCM)
 *  - `tz` + ISO w/ offset / Date / epoch ms → the instant is fixed; the
 *    result is the same instant viewed in `tz`.
 *
 * The branching matters: `dayjs.tz(input, tz)` *re-interprets* the wall-clock
 * portion of an offset-bearing string and silently shifts the instant — which
 * is almost never what callers want when they pass a `Z` suffix.
 */
function toDayjs(input: DateInput, tz?: string): dayjs.Dayjs {
  if (!tz) return dayjs.utc(input);
  if (typeof input === 'string' && !hasTimezoneIndicator(input)) {
    return dayjs.tz(input, tz);
  }
  return dayjs(input).tz(tz);
}

export const DateUtil = {
  /** True when value matches the `YYYY-MM-DD` shorthand. */
  isDateOnly(value: unknown): value is string {
    return typeof value === 'string' && DATE_ONLY_PATTERN.test(value);
  },

  /** True iff value can be parsed as a date. */
  isValid(input: DateInput): boolean {
    return dayjs(input).isValid();
  },

  /** Parse to a dayjs instance in `tz` (or UTC if omitted). */
  parse(input: DateInput, tz?: string): dayjs.Dayjs {
    return toDayjs(input, tz);
  },

  /** Now in the given timezone (or UTC). */
  now(tz?: string): dayjs.Dayjs {
    return tz ? dayjs().tz(tz) : dayjs.utc();
  },

  /** ISO 8601 string. */
  toIso(input: DateInput, tz?: string): string {
    return toDayjs(input, tz).toISOString();
  },

  /** Native JS Date. */
  toDate(input: DateInput, tz?: string): Date {
    return toDayjs(input, tz).toDate();
  },

  /**
   * Format using dayjs format tokens (e.g. `YYYY-MM-DD`, `YYYY-[W]ww`).
   * When `tz` is provided the output is the local time in that zone.
   */
  format(input: DateInput, format: string, tz?: string): string {
    return toDayjs(input, tz).format(format);
  },

  /** Start-of-day ISO 8601 string in `tz` (or UTC). */
  startOfDay(input: DateInput, tz?: string): string {
    return toDayjs(input, tz).startOf('day').toISOString();
  },

  /** End-of-day ISO 8601 string in `tz` (or UTC). 23:59:59.999. */
  endOfDay(input: DateInput, tz?: string): string {
    return toDayjs(input, tz).endOf('day').toISOString();
  },

  /** Start of an arbitrary unit (e.g. `month`, `week`). */
  startOf(input: DateInput, unit: DateUnit, tz?: string): string {
    return toDayjs(input, tz).startOf(unit).toISOString();
  },

  /** End of an arbitrary unit. */
  endOf(input: DateInput, unit: DateUnit, tz?: string): string {
    return toDayjs(input, tz).endOf(unit).toISOString();
  },

  /** Add `amount × unit` to the input. */
  add(input: DateInput, amount: number, unit: DateUnit, tz?: string): dayjs.Dayjs {
    return toDayjs(input, tz).add(amount, unit);
  },

  /** Subtract `amount × unit` from the input. */
  subtract(input: DateInput, amount: number, unit: DateUnit, tz?: string): dayjs.Dayjs {
    return toDayjs(input, tz).subtract(amount, unit);
  },

  // ─── Comparison ────────────────────────────────────────────────────────────

  /** Three-way compare: -1 if a<b, 0 if equal, 1 if a>b. */
  compare(a: DateInput, b: DateInput): -1 | 0 | 1 {
    const da = dayjs(a);
    const db = dayjs(b);
    if (da.isBefore(db)) return -1;
    if (da.isAfter(db)) return 1;
    return 0;
  },

  isBefore(a: DateInput, b: DateInput, unit?: CompareUnit): boolean {
    return dayjs(a).isBefore(dayjs(b), unit);
  },

  isAfter(a: DateInput, b: DateInput, unit?: CompareUnit): boolean {
    return dayjs(a).isAfter(dayjs(b), unit);
  },

  isSame(a: DateInput, b: DateInput, unit?: CompareUnit): boolean {
    return dayjs(a).isSame(dayjs(b), unit);
  },

  isSameOrBefore(a: DateInput, b: DateInput, unit?: CompareUnit): boolean {
    return dayjs(a).isSameOrBefore(dayjs(b), unit);
  },

  isSameOrAfter(a: DateInput, b: DateInput, unit?: CompareUnit): boolean {
    return dayjs(a).isSameOrAfter(dayjs(b), unit);
  },

  /**
   * Distance between two dates expressed in `unit` (a − b). Default unit: day.
   * Pass `floating: true` to get a fractional value (e.g. `1.5` days) — by
   * default dayjs truncates toward zero.
   */
  diff(a: DateInput, b: DateInput, unit: DateUnit = 'day', floating = false): number {
    return dayjs(a).diff(dayjs(b), unit, floating);
  },
};
