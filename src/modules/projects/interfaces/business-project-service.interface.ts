import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import {
  CreateProjectDto,
  ListProjectsDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from '../dto/requests';
import { BusinessProjectResponseDto } from '../dto/responses';
import { ProjectMemberResponseDto } from '../dto/responses/project-member-response.dto';
import { PublishValidationResponseDto } from '../dto/responses/publish-validation-response.dto';

/**
 * Contract for all project operations performed by a business user.
 *
 * Every method resolves the caller's business profile internally via
 * `RequestContextService` — no `businessId` is accepted as a parameter.
 * Ownership is verified on every mutating operation.
 */
export interface IBusinessProjectService {
  /**
   * Creates a new project in `draft` status on behalf of the calling business.
   *
   * Runs inside a transaction: the project row and all required-skill rows are
   * inserted atomically. If the skill insert fails the project is rolled back.
   *
   * @param dto - Validated create payload (title required; skills, introduction,
   *              required_consultants are optional).
   * @returns The newly created project DTO.
   */
  createProject(dto: CreateProjectDto): Promise<BusinessProjectResponseDto>;

  /**
   * Returns a paginated list of all projects owned by the calling business.
   *
   * When `keywords` is provided, results are filtered to projects whose
   * `title` contains the keyword (case-insensitive, ILIKE). Use `sort_by`
   * and `order_by` to control ordering; defaults to `created_at DESC`.
   *
   * Required skills for all returned projects are loaded in a single batch
   * query to avoid N+1.
   *
   * @param dto - Pagination + filter parameters.
   * @returns Paginated wrapper containing project DTOs and page metadata.
   */
  listMyProjects(dto: ListProjectsDto): Promise<PageDto<BusinessProjectResponseDto>>;

  /**
   * Returns a single project by ID, enforcing that it belongs to the calling
   * business. Throws `PROJECT_NOT_FOUND` (404) if the project does not exist
   * or belongs to a different business.
   *
   * @param id - UUID of the project to retrieve.
   * @returns The project DTO with its required skills.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   */
  getProject(id: string): Promise<BusinessProjectResponseDto>;

  /**
   * Applies a partial update to the project. Ownership is verified before any
   * mutation.
   *
   * When `skills` is provided the entire required-skill set is replaced inside
   * the same transaction (delete-then-insert). Omitting `skills` leaves the
   * existing skill set untouched.
   *
   * @param id  - UUID of the project to update.
   * @param dto - Fields to update; all properties are optional.
   * @returns The updated project DTO.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   */
  updateProject(id: string, dto: UpdateProjectDto): Promise<BusinessProjectResponseDto>;

  /**
   * Transitions the project to a new status.
   *
   * Transition validity is enforced entirely by the database trigger
   * `trg_enforce_project_status`. If the requested transition is illegal the DB
   * raises a constraint error which the global exception filter maps to a
   * structured error response. Application code does not duplicate this logic.
   *
   * @param id  - UUID of the project.
   * @param dto - Contains the target `status` value.
   * @returns The project DTO reflecting the new status and any auto-stamped
   *          lifecycle timestamps set by the trigger.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   */
  updateStatus(id: string, dto: UpdateProjectStatusDto): Promise<BusinessProjectResponseDto>;

  /**
   * Validates whether a project is eligible for publication.
   *
   * Checks project status (must be `configured`) and, for pre-paid businesses,
   * whether the account balance covers the total project amount (sum of task
   * prices). Returns a payload with `can_publish`, payment type, and amounts
   * so the frontend can render a confirmation dialog.
   *
   * @param projectId - UUID of the project to validate.
   * @returns Publish validation result DTO.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   */
  validatePublish(projectId: string): Promise<PublishValidationResponseDto>;

  /**
   * Re-validates publish eligibility and transitions the project to `public`.
   *
   * For pre-paid businesses, deducts the project amount from the business
   * account balance and creates a `BusinessTransaction` record inside the
   * same transaction. Credit-based businesses publish without balance changes.
   *
   * @param projectId - UUID of the project to publish.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   * @throws TranslatableException (422) — project not eligible for publication.
   */
  confirmPublish(projectId: string): Promise<void>;

  /**
   * Returns a paginated list of members (consultants) for the given project.
   *
   * Ownership is verified before querying. Each member includes the
   * consultant's avatar, full name, address, membership status, and join date.
   *
   * @param projectId   - UUID of the project.
   * @param pageOptions - Pagination parameters (page, take).
   * @returns Paginated wrapper containing project member DTOs and page metadata.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   */
  listProjectMembers(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ProjectMemberResponseDto>>;

  /**
   * Soft-deletes a project owned by the calling business.
   *
   * Only projects in `draft`, `setting_up`, or `configured` status may be
   * deleted. Once a project is published or beyond, deletion is forbidden.
   *
   * @param id - UUID of the project to delete.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   * @throws TranslatableException (422) — project status does not allow deletion.
   */
  deleteProject(id: string): Promise<void>;
}
