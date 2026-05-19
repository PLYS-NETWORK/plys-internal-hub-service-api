import { PageDto } from '@common/dto/page.dto';

import { ListConsultantProfilesAdminDto } from '../dto/requests/list-consultant-profiles-admin.dto';
import { AdminConsultantProfileDetailResponseDto } from '../dto/responses/admin-consultant-profile-detail-response.dto';
import { AdminConsultantProfileListItemResponseDto } from '../dto/responses/admin-consultant-profile-list-item-response.dto';

/**
 * Contract for platform-admin read operations on consultant profiles. Distinct
 * from `IConsultantProfilesService`, which scopes every method to the
 * authenticated consultant user's own profile via `RequestContextService`.
 *
 * All methods on this contract operate on an arbitrary `id` and assume the
 * caller is authorised by the controller's class-level
 * `@Roles(UserRole.ADMIN_PLATFORM)`.
 */
export interface IConsultantProfilesAdminService {
  /**
   * Returns a paginated slice of **onboarding-approved** consultant profiles
   * (`consultant_profiles.is_verified = true`, atomically mirrored from
   * `consultant_onboardings.status = APPROVED` at decision time). Joins the
   * linked `users` row to surface `email`, `register_date`, and `last_login`.
   * Stored `avatar_url` values are re-presigned through `UrlResolverService`
   * so the response always carries a fresh URL.
   *
   * @param filters Pagination + optional `has_notification_priority` /
   *                `sort_by` / `order_by` filters.
   * @returns `PageDto` of admin list items wrapped in standard pagination
   *          metadata. Empty `data` array when no rows match.
   */
  list(
    filters: ListConsultantProfilesAdminDto,
  ): Promise<PageDto<AdminConsultantProfileListItemResponseDto>>;

  /**
   * Loads a single consultant profile by id with the linked `users` row and
   * the consultant's declared skills. `avatar_url` and `cv_url` are
   * re-presigned through `UrlResolverService`. Unlike `list`, this method
   * does NOT enforce `is_verified = true` — admins occasionally need to
   * inspect a row flagged during onboarding review.
   *
   * @param id Consultant-profile UUID.
   * @returns Detail DTO including `email`, `register_date`, `last_login`,
   *          `cv_url`, `stripe_connect_account_id`, `has_notification_priority`,
   *          `avg_rating`, and the skills array.
   * @throws TranslatableException(CONSULTANT_PROFILE_NOT_FOUND, 404) if the
   *         profile is missing or soft-deleted.
   */
  getById(id: string): Promise<AdminConsultantProfileDetailResponseDto>;
}
