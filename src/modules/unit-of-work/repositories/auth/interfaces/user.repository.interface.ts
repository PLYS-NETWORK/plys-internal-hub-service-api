import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';
import { ActivePlatform } from '@database/enums';

/**
 * Per-platform user counts split by lifecycle status. Used by the admin
 * dashboard's "users" KPI card. `total` is the unfiltered platform total;
 * the rest are subsets that may overlap (e.g. an unverified user can also
 * be banned).
 */
export interface IUsersPlatformStatusBreakdown {
  business: IUsersStatusCounts;
  consultant: IUsersStatusCounts;
}

export interface IUsersStatusCounts {
  total: number;
  /** `is_active = true AND banned_at IS NULL AND last_login_at >= now() - 30 days`. */
  active_30d: number;
  /** `is_email_verified = false`. */
  unverified: number;
  /** `banned_at IS NOT NULL`. */
  banned: number;
}

/**
 * Single bucket in a new-signups time series. `period_label` is the bucket
 * key (`YYYY-MM` for monthly granularity, `IYYY-IW` ISO week for weekly).
 */
export interface INewUsersTrendPoint {
  period_label: string;
  platform: ActivePlatform;
  count: number;
}

export type GrowthTrendGranularity = 'month' | 'week';

export interface IUserRepository extends AbstractRepository<User> {
  findUserByEmailAndPlatform(email: string, platform: ActivePlatform): Promise<User | null>;
  /**
   * Returns the IDs of all users with role ADMIN_PLATFORM whose account is active.
   * Used by the notification event handler to fan-out admin broadcast notifications.
   * @returns Array of userId strings (empty if no active admins).
   */
  findActiveAdminUserIds(): Promise<string[]>;

  /**
   * Returns per-platform counts split into the four status buckets the admin
   * dashboard's users card renders. Single query, four conditional aggregates
   * per platform.
   * @returns `{ business: {...}, consultant: {...} }`.
   */
  countByPlatformGroupedByStatus(): Promise<IUsersPlatformStatusBreakdown>;

  /**
   * Counts users created within a window, grouped by platform. Used by the
   * MTD growth KPIs.
   * @param from Inclusive lower bound on `created_at`.
   * @param to   Inclusive upper bound on `created_at`.
   * @returns `{ business, consultant }` integer counts.
   */
  countNewByPlatformBetween(
    from: Date,
    to: Date,
  ): Promise<{ business: number; consultant: number }>;

  /**
   * Returns new-signup counts grouped by period and platform. Used by the
   * growth-trend chart. Sorted ascending by `period_label`, then platform.
   * @param from Inclusive lower bound on `created_at`.
   * @param to   Inclusive upper bound on `created_at`.
   * @param granularity Bucket size — `month` (`YYYY-MM`) or `week` (`IYYY-IW`).
   */
  countNewByPlatformGroupedByPeriod(
    from: Date,
    to: Date,
    granularity: GrowthTrendGranularity,
  ): Promise<INewUsersTrendPoint[]>;
}
