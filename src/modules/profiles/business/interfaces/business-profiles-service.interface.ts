import { UpdateBusinessProfileDto } from '../dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from '../dto/responses/business-profile-response.dto';

/**
 * Contract for business profile operations.
 *
 * Caller identity is resolved internally via `RequestContextService` on every
 * user-scoped method — no `userId` is accepted as a parameter.
 *
 * The onboarding endpoint lives in its own module
 * (`@modules/business-onboarding`) — see `IBusinessOnboardingService.onboard`.
 */
export interface IBusinessProfilesService {
  /**
   * Returns the authenticated business user's own profile.
   *
   * @returns The caller's `BusinessProfileResponseDto`.
   * @throws TranslatableException (404) — profile not found for the caller.
   */
  getProfile(): Promise<BusinessProfileResponseDto>;

  /**
   * Applies a partial update to the authenticated business user's profile.
   *
   * Only fields explicitly present in `dto` are updated; absent fields are
   * left unchanged. When `tax_id` is changed, the same per-platform +
   * country uniqueness check used during onboarding is applied (the caller's
   * own profile is excluded so no-op updates pass).
   *
   * @param dto - Fields to update; all properties are optional.
   * @returns The updated `BusinessProfileResponseDto`.
   * @throws TranslatableException (404, BUSINESS_PROFILE_NOT_FOUND) — profile
   *   not found for the caller.
   * @throws TranslatableException (409, BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS) —
   *   the new `tax_id` collides with another active account on the same
   *   platform for the same `country_code`.
   */
  updateProfile(dto: UpdateBusinessProfileDto): Promise<BusinessProfileResponseDto>;
}
