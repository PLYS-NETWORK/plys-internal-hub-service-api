import { AdminDecideDto } from '@modules/consultant-application/dto/requests/admin-decide.dto';
import { ListApplicationsDto } from '@modules/consultant-application/dto/requests/list-applications.dto';
import { ApplicationDetailResponseDto } from '@modules/consultant-application/dto/responses/application-detail-response.dto';
import {
  ApplicationListItemResponseDto,
  IPaginatedApplicationsResponse,
} from '@modules/consultant-application/dto/responses/paginated-applications-response.dto';

export interface IAdminApplicationService {
  /**
   * Returns a paginated list of consultant applications for admin review.
   *
   * @param dto Filter + pagination parameters.
   */
  listApplications(dto: ListApplicationsDto): Promise<IPaginatedApplicationsResponse>;

  /**
   * Returns full detail of a single application including all Q&As and scores.
   *
   * @param applicationId UUID of the consultant application.
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if not found.
   */
  getApplicationDetail(applicationId: string): Promise<ApplicationDetailResponseDto>;

  /**
   * Returns a paginated list of items as ApplicationListItemResponseDto (lightweight).
   * Used internally by the list endpoint to map entities to DTOs.
   *
   * @param item Raw application data from the repository.
   */
  toListItemDto(item: {
    id: string;
    user: { email: string };
    status: unknown;
    createdAt: Date;
    interviewSubmittedAt: Date | null;
    finalScore: number | null;
  }): ApplicationListItemResponseDto;

  /**
   * Admin triggers the evaluation pipeline for a submitted interview.
   * Sets status to RUNNING_COPYLEAKS and dispatches RUN_COPYLEAKS_EVALUATION job.
   *
   * @param applicationId UUID of the consultant application.
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if not found.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INVALID_STATUS if not INTERVIEW_SUBMITTED.
   */
  startEvaluation(applicationId: string): Promise<void>;

  /**
   * Admin makes the final approval/rejection decision.
   * On APPROVED: sets ConsultantProfile.isVerified = true, saves skill scores, sends email.
   * On REJECTED: sets blockedUntil, sends rejection email.
   *
   * @param applicationId UUID of the consultant application.
   * @param dto Decision and optional reason.
   * @throws TranslatableException — CONSULTANT_APPLICATION_NOT_FOUND if not found.
   * @throws TranslatableException — CONSULTANT_APPLICATION_INVALID_STATUS if not PENDING_FINAL_DECISION.
   */
  makeDecision(applicationId: string, dto: AdminDecideDto): Promise<void>;
}
