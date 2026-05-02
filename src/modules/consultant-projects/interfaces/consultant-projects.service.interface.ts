import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import {
  ConsultantProjectDetailResponseDto,
  ConsultantProjectListItemResponseDto,
} from '../dto/responses';

export interface IConsultantProjectsService {
  /**
   * Paginated list of projects matching the consultant's skills.
   * Surfaces availability, match-rate, and is-applied flags so the UI can
   * render the discovery feed in a single round-trip.
   *
   * @param pageOptions Pagination params (page, limit, optional sort_by/order).
   * @returns Paginated list of projects.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   */
  list(pageOptions: PageOptionsDto): Promise<PageDto<ConsultantProjectListItemResponseDto>>;

  /**
   * Detail of a single discoverable project. The project must be publicly
   * accessible (PUBLISHED/IN_PROGRESS) OR the caller must already be an
   * active member.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   */
  getDetail(projectId: string): Promise<ConsultantProjectDetailResponseDto>;
}
