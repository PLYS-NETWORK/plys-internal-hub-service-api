import { SubmitProfileDto } from '../dto/requests/submit-profile.dto';
import { ApplicationStatusResponseDto } from '../dto/responses/application-status-response.dto';

export interface IConsultantApplicationService {
  /**
   * Returns the current application status for the authenticated consultant.
   * If no application exists, returns null.
   */
  getMyApplicationStatus(): Promise<ApplicationStatusResponseDto | null>;

  /**
   * Submits or re-submits the consultant's profile information.
   * Creates a new application if none is active; updates profile fields otherwise.
   * Enforces block check before proceeding.
   * Dispatches GENERATE_SKILL_QUESTIONS job on success.
   *
   * @param dto Profile and skill data.
   * @throws TranslatableException — CONSULTANT_APPLICATION_BLOCKED if blocked.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INVALID_STATUS if status does not allow edits.
   */
  submitProfile(dto: SubmitProfileDto): Promise<ApplicationStatusResponseDto>;
}
