import { DateUtil } from '@common/utils/date';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

import { IStatsDateRangeRequest } from './interfaces/stats-date-range.request.interface';

// IANA zone names (e.g. "Asia/Ho_Chi_Minh", "UTC", "Etc/GMT+7"). The pattern
// is intentionally permissive — dayjs will reject anything it can't load, and
// invalid zones surface as a parse failure rather than a regex mismatch.
const TIMEZONE_PATTERN = /^[A-Za-z_]+(?:\/[A-Za-z_+\-0-9]+)*$/;

// `YYYY-MM-DD` shorthand → start/end of that day in the caller's `tz`
// (or UTC if omitted). Full ISO strings are normalised through DateUtil so
// downstream consumers always receive a timezone-aware ISO 8601 timestamp.
function expandFromBoundary(value: unknown, tz?: string): unknown {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (DateUtil.isDateOnly(value)) return DateUtil.startOfDay(value, tz);
  return DateUtil.isValid(value) ? DateUtil.toIso(value) : value;
}

function expandToBoundary(value: unknown, tz?: string): unknown {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (DateUtil.isDateOnly(value)) return DateUtil.endOfDay(value, tz);
  return DateUtil.isValid(value) ? DateUtil.toIso(value) : value;
}

/**
 * Common query parameters shared across most statistics endpoints.
 * `from` / `to` apply to whichever timestamp the endpoint groups on
 * (e.g. `created_at` for projects, `created_at` for transactions).
 *
 * Date-only inputs (`YYYY-MM-DD`) are auto-expanded to start/end-of-day in
 * the supplied `tz` (or UTC when no `tz` is given). Full ISO 8601 inputs
 * pass through unchanged so callers can pin a precise instant.
 */
export class StatsDateRangeDto implements IStatsDateRangeRequest {
  // tz must be transformed *before* `from` / `to` so the boundary helpers
  // see the value. class-transformer applies @Transform in property
  // declaration order, so `tz` is declared first.
  @Expose({ name: 'tz' })
  @ApiPropertyOptional({
    name: 'tz',
    example: 'Asia/Ho_Chi_Minh',
    description:
      'Optional IANA timezone applied to date-only `from`/`to` shorthand. Defaults to UTC.',
  })
  @IsString()
  @Matches(TIMEZONE_PATTERN)
  @IsOptional()
  public readonly tz?: string;

  @Expose({ name: 'from' })
  @ApiPropertyOptional({
    name: 'from',
    example: '2025-11-01',
    description:
      'Inclusive lower bound. Accepts `YYYY-MM-DD` (auto-expanded to start-of-day in `tz`) or a full ISO 8601 timestamp.',
  })
  @Transform(({ value, obj }: { value: unknown; obj: Record<string, unknown> }) =>
    expandFromBoundary(value, typeof obj.tz === 'string' ? obj.tz : undefined),
  )
  @IsISO8601()
  @IsOptional()
  public readonly from?: string;

  @Expose({ name: 'to' })
  @ApiPropertyOptional({
    name: 'to',
    example: '2026-04-30',
    description:
      'Inclusive upper bound. Accepts `YYYY-MM-DD` (auto-expanded to end-of-day in `tz`) or a full ISO 8601 timestamp.',
  })
  @Transform(({ value, obj }: { value: unknown; obj: Record<string, unknown> }) =>
    expandToBoundary(value, typeof obj.tz === 'string' ? obj.tz : undefined),
  )
  @IsISO8601()
  @IsOptional()
  public readonly to?: string;

  @Expose({ name: 'project_id' })
  @ApiPropertyOptional({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  public readonly projectId?: string;
}
