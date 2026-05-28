import { UpdateProjectSettingsDto } from '../dto/requests';
import { ProjectSettingsResponseDto, ProjectSummaryResponseDto } from '../dto/responses';

/**
 * Project metadata management. Disallowed once the project reaches a terminal
 * state (DONE, CANCELLED).
 */
export interface ISettingsService {
  /**
   * Returns the current settings shape used by the edit screen — the same
   * fields the PATCH method writes to.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   */
  getSettings(projectId: string): Promise<ProjectSettingsResponseDto>;

  /** Updates editable project fields. `required_skills` replaces the full set when present. */
  updateProject(
    projectId: string,
    dto: UpdateProjectSettingsDto,
  ): Promise<ProjectSummaryResponseDto>;
}
