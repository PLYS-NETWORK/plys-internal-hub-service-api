import { PageDto } from '@common/dto/page.dto';

import { ListApplicationsDto, RejectApplicationDto } from '../dto/requests';
import { ApplicationDetailResponseDto, ApplicationListItemResponseDto } from '../dto/responses';

export interface IApplicationsService {
  /**
   * Paginated applications for a project the calling business owns.
   * Each item carries a precomputed `matching_rate` (0–100).
   */
  list(
    projectId: string,
    dto: ListApplicationsDto,
  ): Promise<PageDto<ApplicationListItemResponseDto>>;

  /**
   * Full application detail including consultant skills and interview answers
   * (with the `is_question_deleted` flag preserved for soft-deleted questions).
   */
  getDetail(projectId: string, applicationId: string): Promise<ApplicationDetailResponseDto>;

  /**
   * Approves the application — only when current status is PENDING.
   * Side effects: ACCEPTED, reviewedAt/reviewedBy stamped, ProjectMember row,
   * approval email.
   */
  approve(projectId: string, applicationId: string): Promise<void>;

  /**
   * Rejects the application — only when current status is PENDING.
   * Side effects: REJECTED, reviewedAt/reviewedBy/rejectionReason stamped,
   * decline email.
   */
  reject(projectId: string, applicationId: string, dto: RejectApplicationDto): Promise<void>;
}
