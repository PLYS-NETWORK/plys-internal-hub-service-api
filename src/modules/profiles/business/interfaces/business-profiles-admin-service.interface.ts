import { PageDto } from '@common/dto/page.dto';

import { ListBusinessProfilesDto } from '../dto/requests/list-business-profiles.dto';
import { AdminBusinessProfileDetailResponseDto } from '../dto/responses/admin-business-profile-detail-response.dto';
import { AdminBusinessProfileListItemResponseDto } from '../dto/responses/admin-business-profile-list-item-response.dto';

/**
 * Contract for platform-admin operations on business profiles. Distinct
 * from `IBusinessProfilesService`, which scopes every method to the
 * authenticated business user's own profile via `RequestContextService`.
 *
 * All methods on this contract operate on an arbitrary `id` and assume the
 * caller is authorised by the controller's class-level
 * `@Roles(UserRole.ADMIN_PLATFORM)`.
 */
export interface IBusinessProfilesAdminService {
  /**
   * Returns a paginated, optionally-filtered slice of non-soft-deleted
   * business profiles. Joins the linked `users` row to surface the auth
   * account's `email`, `register_date`, and `last_login`.
   *
   * @param filters Pagination + optional `is_partner_platform` /
   *                `is_verified` / `sort_by` / `order_by` filters.
   * @returns `PageDto` of admin list items wrapped in standard pagination
   *          metadata. Empty `data` array when no rows match.
   */
  list(filters: ListBusinessProfilesDto): Promise<PageDto<AdminBusinessProfileListItemResponseDto>>;

  /**
   * Loads a single business profile by id with the linked `users` row.
   *
   * @param id Business-profile UUID.
   * @returns Detail DTO including `email`, `register_date`, and `last_login`.
   * @throws TranslatableException(BUSINESS_PROFILE_NOT_FOUND, 404) if the
   *         profile is missing or soft-deleted.
   */
  getById(id: string): Promise<AdminBusinessProfileDetailResponseDto>;

  /**
   * Bidirectional setter for `business_profiles.is_partner_platform`.
   * Idempotent — re-setting the existing value is a no-op observable change.
   *
   * @param id    Business-profile UUID.
   * @param value New flag value (`true` to mark as partner, `false` to
   *              demote).
   * @throws TranslatableException(BUSINESS_PROFILE_NOT_FOUND, 404) if the
   *         profile is missing or soft-deleted.
   */
  setPartnerPlatform(id: string, value: boolean): Promise<void>;

  /**
   * Bidirectional setter for `business_profiles.allow_payment_credit`.
   * Idempotent.
   *
   * @param id    Business-profile UUID.
   * @param value New flag value (`true` to enable invoice/credit billing,
   *              `false` to require pre-paid balance).
   * @throws TranslatableException(BUSINESS_PROFILE_NOT_FOUND, 404) if the
   *         profile is missing or soft-deleted.
   */
  setAllowPaymentCredit(id: string, value: boolean): Promise<void>;
}
