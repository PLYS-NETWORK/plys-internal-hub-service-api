import { GetMilestonesDto } from '../dto/requests/get-milestones.dto';
import { BoardMilestonesResponseDto } from '../dto/responses/board-milestones-response.dto';

export interface IBoardMilestonesService {
  /**
   * Counts tasks by kanban status for the given project, excluding DRAFT and soft-deleted rows.
   * The result is cached per (projectId, userId, timezone) for ~60s. Pass `is_remove_cache=true`
   * to bypass and refresh. The cache is automatically invalidated by any task or attachment mutation.
   *
   * @param projectId Project owned by the calling business.
   * @param filters   Cache-control options.
   * @returns Total task count and per-status breakdown.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *   not owned by the calling business.
   */
  getSummary(projectId: string, filters: GetMilestonesDto): Promise<BoardMilestonesResponseDto>;
}
