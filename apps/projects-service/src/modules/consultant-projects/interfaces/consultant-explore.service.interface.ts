import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';

import { ListConsultantExploreProjectsDto } from '../dto/requests/list-consultant-explore-projects.dto';
import {
  ConsultantExploreProjectDetailResponseDto,
  ConsultantExploreProjectListItemResponseDto,
} from '../dto/responses';

export interface IConsultantExploreService {
  /**
   * Paginated discovery feed for the calling consultant. Returns every
   * PUBLISHED + IN_PROGRESS project (joined or not joined) ordered with
   * partner-platform projects pinned to the top, then by `published_at`
   * DESC, then by `id` ASC. Optional case-insensitive title substring and
   * single-status narrow. Per-item flags include the consultant-specific
   * `match_rate` and `is_joined`. Cached in Redis for 60 s, keyed on
   * consultantId + lang so each consultant gets their own slot.
   *
   * @param dto - Pagination + filter params (`title`, `status`).
   * @returns A paginated page of list-item DTOs.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND when the
   *         caller has no consultant profile.
   */
  list(
    dto: ListConsultantExploreProjectsDto,
  ): Promise<PageDto<ConsultantExploreProjectListItemResponseDto>>;

  /**
   * Detail view of a single project the consultant may discover or has
   * already joined. Returns the discovery fields plus the project's full
   * `introduction`, lifecycle timestamps, and required skills with
   * i18n-translated labels. Cached in Redis for 120 s, keyed on
   * consultantId + lang + id.
   *
   * @param projectId - UUID of the project.
   * @returns The detail response DTO.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *         not discoverable and the caller has no ACTIVE membership.
   */
  getDetail(projectId: string): Promise<ConsultantExploreProjectDetailResponseDto>;
}
