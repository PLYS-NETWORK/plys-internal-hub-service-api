import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import {
  ConsultantProjectListItemResponseDto,
  ConsultantProjectResponseDto,
} from '../dto/responses';

/**
 * Contract for project discovery operations performed by a consultant user.
 *
 * The caller's consultant profile is resolved internally via
 * `RequestContextService` — no `consultantId` is accepted as a parameter.
 */
export interface IConsultantProjectService {
  /**
   * Returns a paginated list of `public` projects that require at least one
   * skill the calling consultant possesses.
   *
   * **Matching logic:**
   * A project is included when its `project_required_skills` set intersects
   * with the consultant's `consultant_skills` set (skill UUID overlap). The
   * query uses a subquery (`WHERE project.id IN (SELECT project_id FROM
   * project_required_skills WHERE skill_id IN (...))`) so each project appears
   * at most once regardless of how many skills match.
   *
   * **Empty skill list:**
   * If the consultant has no skills on record, an empty page is returned
   * immediately without hitting the projects table.
   *
   * Required skills for all returned projects are loaded in a single batch
   * query to avoid N+1.
   *
   * The list payload is slimmed for discovery: `business_id`, `status`,
   * `started_at`, and `cancelled_at` are omitted (status is implicitly
   * `public` for the consultant list); the full interview question set is
   * collapsed to a `need_interview: boolean` flag. Full question text is
   * available via `getProjectDetail`.
   *
   * @param pageOptions - Pagination parameters (page, limit, order).
   * @returns Paginated wrapper containing matched list-item DTOs and page metadata.
   * @throws TranslatableException (403) — caller has no consultant profile.
   */
  findMatchingProjects(
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ConsultantProjectListItemResponseDto>>;

  /**
   * Returns the detail of a single `public` project by ID.
   *
   * Any verified consultant may view any public project regardless of skill
   * overlap — this is a direct lookup, not a matching query.
   *
   * @param id - UUID of the project.
   * @returns Full project DTO including company info, skills, and interview questions.
   * @throws TranslatableException (403) — caller has no consultant profile.
   * @throws TranslatableException (404) — project not found or not in `public` status.
   */
  getProjectDetail(id: string): Promise<ConsultantProjectResponseDto>;
}
