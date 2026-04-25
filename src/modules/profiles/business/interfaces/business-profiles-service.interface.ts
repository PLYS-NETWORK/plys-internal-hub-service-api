import { OnboardBusinessProfileDto } from '../dto/requests/onboard-business-profile.dto';
import { UpdateBusinessProfileDto } from '../dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from '../dto/responses/business-profile-response.dto';

/**
 * Contract for business profile operations.
 *
 * Caller identity is resolved internally via `RequestContextService` on every
 * user-scoped method — no `userId` is accepted as a parameter.
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
   * Creates a new business profile for the authenticated user.
   *
   * Business profiles are marked `isVerified = true` immediately on creation
   * (auto-verified). Throws if a profile already exists for the caller.
   *
   * @param dto - Validated onboarding payload including company details and
   *              address information.
   * @returns The newly created `BusinessProfileResponseDto`.
   * @throws TranslatableException (409) — profile already exists for the caller.
   */
  onboard(dto: OnboardBusinessProfileDto): Promise<BusinessProfileResponseDto>;

  /**
   * Applies a partial update to the authenticated business user's profile.
   *
   * Only fields explicitly present in `dto` are updated; absent fields are
   * left unchanged.
   *
   * @param dto - Fields to update; all properties are optional.
   * @returns The updated `BusinessProfileResponseDto`.
   * @throws TranslatableException (404) — profile not found for the caller.
   */
  updateProfile(dto: UpdateBusinessProfileDto): Promise<BusinessProfileResponseDto>;

  /**
   * Marks a business profile as a partner platform (admin operation).
   *
   * Sets `isPartnerPlatform = true` on the target profile, granting partner
   * pricing and features.
   *
   * @param profileId - UUID of the business profile to mark as partner.
   * @throws TranslatableException (404) — profile not found.
   */
  markAsPartner(profileId: string): Promise<void>;

  /**
   * Enables the payment-credit mode for a business profile (admin operation).
   *
   * Sets `allowPaymentCredit = true`, allowing the business to accrue charges
   * and pay via invoice instead of pre-paid balance.
   *
   * @param profileId - UUID of the business profile to update.
   * @throws TranslatableException (404) — profile not found.
   */
  allowPaymentCredit(profileId: string): Promise<void>;
}
