import { SubmitOnboardingProfileDto } from '../dto/requests/submit-onboarding-profile.dto';
import { OnboardingStatusResponseDto } from '../dto/responses/onboarding-status-response.dto';

/**
 * Contract for the consultant-onboarding service.
 *
 * Caller identity is resolved internally via `RequestContextService` on every
 * method — no `userId` is accepted as a parameter.
 */
export interface IConsultantOnboardingService {
  /**
   * Returns the authenticated consultant's onboarding row, or null when the
   * consultant has not started the flow yet.
   *
   * @returns The current onboarding state, or `null` if no row exists.
   */
  getStatus(): Promise<OnboardingStatusResponseDto | null>;

  /**
   * Creates a new onboarding row (or resets one still in `PENDING_BASIC_INFO`),
   * writes the basic profile fields onto `ConsultantProfile`, advances to
   * `IN_INTERVIEW`, and synchronously assigns 5 COMMUNICATION + 5 SYSTEM_KNOWLEDGE
   * questions drawn at random from the seed bank.
   *
   * @param dto Validated profile payload.
   * @returns The onboarding row after the status transition.
   * @throws TranslatableException (403, CONSULTANT_ONBOARDING_BLOCKED) — caller is
   *   under an active 3-month block from a prior REJECTED onboarding.
   * @throws TranslatableException (409, CONSULTANT_ONBOARDING_INVALID_STATUS) — the
   *   onboarding already exists with a status past `PENDING_BASIC_INFO`.
   */
  submitProfile(dto: SubmitOnboardingProfileDto): Promise<OnboardingStatusResponseDto>;
}
