import { PageDto } from '@common/dto/page.dto';

import { ListConsultantJoinedProjectsDto } from '../dto/requests/list-consultant-joined-projects.dto';
import { ListConsultantWorkspacesDto } from '../dto/requests/list-consultant-workspaces.dto';
import {
  ConsultantJoinedProjectDetailResponseDto,
  ConsultantJoinedProjectListItemResponseDto,
  ConsultantWorkspaceListItemResponseDto,
} from '../dto/responses';

/**
 * Read-only surface for the consultant's joined-project navigation: the
 * workspace switcher, the joined-projects list with per-consultant stats, and
 * the joined-project detail page.
 *
 * Every method scopes results to consultants with an ACTIVE `ProjectMember`
 * row. LEFT and REMOVED memberships are invisible. Cached for 60–120s per
 * key; writes in {@link IConsultantProjectTasksService} invalidate via
 * {@link IConsultantJoinedCacheService}.
 */
export interface IConsultantJoinedProjectsService {
  /**
   * Lightweight switcher list. Returns only `id`, `code`, `title`, `status`
   * — kept small because this endpoint is hit on every workspace navigation.
   *
   * @param dto Pagination + optional case-insensitive keyword (title or code).
   * @returns Paginated workspace items sorted alphabetically by title.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   */
  listWorkspaces(
    dto: ListConsultantWorkspacesDto,
  ): Promise<PageDto<ConsultantWorkspaceListItemResponseDto>>;

  /**
   * Full joined-projects list with progress aggregates. Each item carries
   * the project's overall completion percentage and the count of DONE tasks
   * assigned to the caller.
   *
   * @param dto Pagination + optional case-insensitive keyword.
   * @returns Paginated joined-project items sorted by `joined_at DESC`.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   */
  listJoinedProjects(
    dto: ListConsultantJoinedProjectsDto,
  ): Promise<PageDto<ConsultantJoinedProjectListItemResponseDto>>;

  /**
   * Joined-project detail with the full progress block.
   *
   * @param projectId UUID of the project to load.
   * @returns Detail DTO including overall + per-caller progress counters.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *         missing or the caller has no ACTIVE membership.
   */
  getJoinedProjectDetail(projectId: string): Promise<ConsultantJoinedProjectDetailResponseDto>;
}
