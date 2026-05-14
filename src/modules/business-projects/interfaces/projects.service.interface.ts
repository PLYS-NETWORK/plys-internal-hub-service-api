import { PageDto } from '@common/dto/page.dto';

import { CreateProjectDto, ListProjectsDto, SearchProjectsDto } from '../dto/requests';
import { TransitionProjectStatusDto } from '../dto/requests/transition-project-status.dto';
import {
  ProjectListItemResponseDto,
  ProjectSearchItemResponseDto,
  ProjectSummaryResponseDto,
} from '../dto/responses';

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

  /**
   * Lightweight search of the calling business's projects, intended for
   * project-picker / workspace-switcher dropdowns. Filters by case-insensitive
   * substring on either `title` OR `code`, paginated, returns the minimal
   * `{ id, code, title }` shape only.
   *
   * @param dto Pagination + optional `keywords` filter (2–200 chars, trimmed).
   * @returns Paged list of lightweight project items ordered by `created_at DESC`.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND when the
   *   caller has no business profile.
   */
  searchMyProjects(dto: SearchProjectsDto): Promise<PageDto<ProjectSearchItemResponseDto>>;

  /**
   * Soft-deletes a project owned by the calling business. Only allowed while
   * the project is still in the pre-publish lifecycle: `DRAFT` or `CONFIGURED`.
   * Once published or beyond, the project carries financial and member state
   * that must be preserved — callers should cancel instead.
   *
   * Soft delete sets `deleted_at` (and `deleted_by` via AuditSubscriber);
   * child rows (tasks, interview questions, required skills) are left in
   * place because their FKs use ON DELETE CASCADE only on a hard delete and
   * the read paths already filter by `deleted_at IS NULL` on the project.
   *
   * @param projectId UUID of the project to delete.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND when the
   *   caller has no business profile.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project
   *   does not exist or is not owned by the caller's business.
   * @throws TranslatableException 422 PROJECT_CANNOT_BE_DELETED when the
   *   project status is past `CONFIGURED`.
   */
  deleteProject(projectId: string): Promise<void>;

  /**
   * Explicit `draft → configured` transition with a price-gate validation.
   * The auto-recompute already moves a fully-signalled project to
   * `configured`; this endpoint is the AI runner's "stamp it" step that
   * also asserts no draft task has `price = 0` (since publishing turns
   * tasks into financial commitments).
   *
   * @param projectId UUID of the project to transition.
   * @param dto Target status (currently only `configured`).
   * @returns Project summary with the new status.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 409 PROJECT_INVALID_STATUS_TRANSITION when
   *   the project is not currently `draft`.
   * @throws TranslatableException 409 PROJECT_PRICE_GATE_FAILED — `details`
   *   carries `{ offending_task_ids: string[] }` for the FE to highlight.
   */
  transitionStatus(
    projectId: string,
    dto: TransitionProjectStatusDto,
  ): Promise<ProjectSummaryResponseDto>;
}
