import { PageDto } from '@common/dto/page.dto';

import { CreateProjectDto, ListProjectsDto } from '../dto/requests';
import {
  ProjectListItemResponseDto,
  ProjectSummaryResponseDto,
  PublishValidationResponseDto,
} from '../dto/responses';

/**
 * Business-facing project operations on the main controller surface
 * (`POST /projects/business`, `GET /projects/business`, publish-validation,
 * publish). The remaining business flows live on dedicated controllers and
 * their services (overview, backlogs, settings, applications, board).
 */
export interface IBusinessProjectsService {
  /**
   * Creates a new project owned by the calling business in DRAFT status.
   * Server-side defaults: `requiredConsultants = 1`, no skills/tasks/questions.
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

  /**
   * Returns a read-only validation result for the publish modal. Mirrors the
   * legacy `validatePublish` — does not change any state.
   *
   * @param projectId Project to validate.
   * @returns Publish eligibility, project amount, commission, account balance.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project does
   *   not exist or is not owned by the calling business.
   */
  validatePublish(projectId: string): Promise<PublishValidationResponseDto>;

  /**
   * Atomically transitions the project to PUBLISHED and settles payment.
   * Re-runs validation inside the locked transaction; pre-flight
   * `validatePublish` is advisory only.
   *
   * @param projectId Project to publish.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 422 PROJECT_INSUFFICIENT_BALANCE
   *   (pre-paid only, locked re-check).
   * @throws TranslatableException 422 PROJECT_CANNOT_PUBLISH for any other
   *   non-eligibility (zero tasks, wrong status, etc.).
   */
  confirmPublish(projectId: string): Promise<void>;
}
