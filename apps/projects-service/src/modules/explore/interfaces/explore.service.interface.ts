import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';

import { ListExploreProjectsDto } from '../dto/requests/list-explore-projects.dto';
import {
  ExploreProjectDetailResponseDto,
  ExploreProjectListItemResponseDto,
  ExploreSkillResponseDto,
} from '../dto/responses';

export const EXPLORE_SERVICE = Symbol('IExploreService');

export interface IExploreService {
  /**
   * Returns the full skill taxonomy translated into the request locale. Used
   * to populate the explore page's "required skills" filter. Cached in Redis
   * for 1 hour because skills are reference data and rarely change.
   * @returns Array of skills (id, raw i18n key, translated label, optional category).
   */
  listSkills(): Promise<ExploreSkillResponseDto[]>;

  /**
   * Returns a paginated, filterable list of publicly visible projects
   * (status ∈ {PUBLISHED, IN_PROGRESS}). Projects whose owning business has
   * `is_partner_platform = true` are pinned to the top of the list.
   * Results are cached per (locale, page, limit, filters) tuple for 60s.
   * @param dto Pagination + filter (skill_ids ANY-match, title substring).
   * @returns Page envelope of {@link ExploreProjectListItemResponseDto}.
   */
  listProjects(dto: ListExploreProjectsDto): Promise<PageDto<ExploreProjectListItemResponseDto>>;

  /**
   * Returns the public detail view of a single project — non-sensitive
   * fields plus the project's required skill list. Cached per (locale, id)
   * for 120s.
   * @param id UUID of the project.
   * @returns Project detail DTO.
   * @throws TranslatableException PROJECT_NOT_FOUND when the project does
   * not exist, is soft-deleted, or is not in an accessible status.
   */
  getProjectDetail(id: string): Promise<ExploreProjectDetailResponseDto>;
}
