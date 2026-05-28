import type { Order } from '@plys/libraries/common-nest/dto/page-options.dto';

/**
 * camelCase TS-internal shape of the admin consultant-profiles list query.
 * The HTTP contract is snake_case — `@Expose({ name: '…' })` on the DTO maps
 * `has_notification_priority` query param to this camelCase property during
 * `class-transformer`'s plainToInstance pass.
 *
 * `is_verified` is NOT exposed as a query param: the list endpoint hard-filters
 * to onboarding-approved consultants (`consultant_profiles.is_verified = true`),
 * which is atomically mirrored from `consultant_onboardings.status = APPROVED`.
 */
export interface IListConsultantProfilesAdminRequest {
  readonly page: number;
  readonly limit: number;
  readonly sort_by?: string;
  readonly order_by?: Order;
  readonly hasNotificationPriority?: boolean;
}
