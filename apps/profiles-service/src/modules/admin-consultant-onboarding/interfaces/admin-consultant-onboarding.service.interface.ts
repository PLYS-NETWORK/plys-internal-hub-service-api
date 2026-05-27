import { ListOnboardingsDto } from '../dto/requests/list-onboardings.dto';
import { OnboardingDecisionDto } from '../dto/requests/onboarding-decision.dto';
import { OnboardingDetailResponseDto } from '../dto/responses/onboarding-detail-response.dto';
import { PaginatedOnboardingsResponseDto } from '../dto/responses/onboarding-list-item-response.dto';

/**
 * Contract for admin operations on consultant onboardings.
 */
export interface IAdminConsultantOnboardingService {
  /**
   * Paginated list of consultant onboardings with optional status filter.
   * @param dto Pagination + filter input.
   */
  list(dto: ListOnboardingsDto): Promise<PaginatedOnboardingsResponseDto>;

  /**
   * Returns the full onboarding detail for a single row including the 10 Q&As.
   * @param id Onboarding row UUID.
   * @throws TranslatableException (404, CONSULTANT_ONBOARDING_NOT_FOUND).
   */
  getDetail(id: string): Promise<OnboardingDetailResponseDto>;

  /**
   * Records the admin's decision on an onboarding.
   *
   * - `APPROVED`: sets `ConsultantProfile.isVerified = true`, emits
   *   `CONSULTANT_ONBOARDING_APPROVED` so an in-app notification is dispatched,
   *   and sends the approval email.
   * - `REJECTED`: sets `blocked_until = now + 3 months`, sends the rejection
   *   email with the admin-supplied note.
   *
   * @param id Onboarding row UUID.
   * @param dto The admin decision payload.
   * @throws TranslatableException (404, CONSULTANT_ONBOARDING_NOT_FOUND).
   * @throws TranslatableException (409, CONSULTANT_ONBOARDING_INVALID_STATUS) — onboarding is not in `INTERVIEW_SUBMITTED`.
   */
  decide(id: string, dto: OnboardingDecisionDto): Promise<OnboardingDetailResponseDto>;
}
