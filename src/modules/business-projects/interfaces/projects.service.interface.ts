import { PageDto } from '@common/dto/page.dto';

import { CreateProjectDto, ListProjectsDto } from '../dto/requests';
import { ProjectListItemResponseDto, ProjectSummaryResponseDto } from '../dto/responses';

/**
 * Core CRUD operations for business projects on the main controller surface
 * (`POST /projects/business`, `GET /projects/business`). Publish/republish
 * flows live on dedicated services (`IProjectPublishService`,
 * `IProjectRepublishService`) — the controller composes all three.
 */
export interface IBusinessProjectsService {
  /**
   * Creates a new project owned by the calling business in DRAFT status.
   * Server-side defaults: `requiredConsultants = 0`, no skills/tasks/questions.
   *
   * @param dto Create payload (title required, introduction optional).
   * @returns Project summary including the generated id and DRAFT status.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND when the
   *   authenticated user has no business profile or the JWT businessId does
   *   not match the user.
   */
  createProject(dto: CreateProjectDto): Promise<ProjectSummaryResponseDto>;

  /**
   * Lists the calling business's own projects, paginated and optionally
   * filtered by a case-insensitive title keyword.
   *
   * @param dto Pagination + optional `keywords` filter.
   * @returns Paged list with per-project task / member / application counts.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   */
  listMyProjects(dto: ListProjectsDto): Promise<PageDto<ProjectListItemResponseDto>>;
}
