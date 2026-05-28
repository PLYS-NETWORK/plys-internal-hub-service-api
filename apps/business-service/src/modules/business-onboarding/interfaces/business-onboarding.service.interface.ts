import { BusinessProfileResponseDto } from '@modules/profiles/dto/responses/business-profile-response.dto';

import { OnboardBusinessProfileDto } from '../dto/requests/onboard-business-profile.dto';

/**
 * Contract for the business-onboarding service.
 *
 * Caller identity is resolved internally via `RequestContextService` — no
 * `userId` is accepted as a parameter.
 */
export interface IBusinessOnboardingService {
  /**
   * Completes onboarding for the authenticated business user by populating the
   * profile stub (created at registration) with company details and the new
   * `tax_id`, then sets `is_verified = true` and emits
   * `NOTIFICATION_EVENTS.BUSINESS_ONBOARDED`.
   *
   * Uniqueness check: the `(tax_id, country_code)` pair must not collide with
   * any other active account on the same `ActivePlatform`. The check ignores
   * de-activated and banned accounts so re-onboarding remains possible.
   *
   * @param dto Validated onboarding payload (company details + tax_id).
   * @returns The updated business profile in the standard response shape.
   * @throws TranslatableException (404, BUSINESS_PROFILE_NOT_FOUND) — caller has
   *   no profile stub (i.e. registration was not completed).
   * @throws TranslatableException (409, BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS) —
   *   another active account on the same platform already owns this
   *   tax_id + country_code combination.
   */
  onboard(dto: OnboardBusinessProfileDto): Promise<BusinessProfileResponseDto>;
}
