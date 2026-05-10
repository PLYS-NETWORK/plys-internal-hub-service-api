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
   * Completes onboarding for the authenticated user by populating the
   * pre-created profile stub and marking it as verified.
   *
   * A profile row is created automatically at registration time. This method
   * fills in the company details and sets `isVerified = true`. Throws if no
   * profile stub exists (i.e. the user has not completed registration).
   *
   * @param dto - Validated onboarding payload including company details and
   *              address information.
   * @returns The updated `BusinessProfileResponseDto`.
   * @throws TranslatableException (404) — no profile found for the caller.
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
}
