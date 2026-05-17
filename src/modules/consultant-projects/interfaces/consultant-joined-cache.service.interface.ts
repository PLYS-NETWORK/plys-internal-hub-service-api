import { ListConsultantJoinedProjectsDto } from '../dto/requests/list-consultant-joined-projects.dto';
import { ListConsultantProjectTasksDto } from '../dto/requests/list-consultant-project-tasks.dto';
import { ListConsultantWorkspacesDto } from '../dto/requests/list-consultant-workspaces.dto';

/**
 * Cache key/TTL/invalidate helper for the consultant joined-project surfaces.
 * Reads and writes share this service so key shapes stay identical — a write
 * that invalidates keys the read uses different from would silently leak
 * stale data through the TTL window.
 */
export interface IConsultantJoinedCacheService {
  /** Key for {@link ConsultantJoinedProjectsService.listWorkspaces}. */
  buildWorkspaceListKey(consultantId: string, dto: ListConsultantWorkspacesDto): string;

  /** Key for {@link ConsultantJoinedProjectsService.listJoinedProjects}. */
  buildJoinedListKey(consultantId: string, dto: ListConsultantJoinedProjectsDto): string;

  /** Key for {@link ConsultantJoinedProjectsService.getJoinedProjectDetail}. */
  buildJoinedDetailKey(consultantId: string, projectId: string): string;

  /** Key for {@link ConsultantProjectTasksService.listTasks}. */
  buildTaskListKey(
    consultantId: string,
    projectId: string,
    dto: ListConsultantProjectTasksDto,
  ): string;

  /**
   * Reads a JSON-encoded value. Returns null on cache miss OR Redis error so
   * callers fall through to the database — caches must never take down the
   * endpoint.
   */
  read<T>(key: string): Promise<T | null>;

  /**
   * Writes a JSON-encoded value with the given TTL. Redis errors are logged
   * and swallowed; callers always succeed.
   */
  write<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * Pattern-delete every cache key affected by a write on
   * (consultantId, projectId): workspace list, joined list, joined detail,
   * and the project's task list. Redis failures fall back to TTL expiry.
   */
  invalidateForConsultantProject(consultantId: string, projectId: string): Promise<void>;
}

/** TTLs in seconds — mirrored from the explore module's caches. */
export const CONSULTANT_JOINED_CACHE_TTL = {
  workspaceList: 60,
  joinedList: 60,
  joinedDetail: 120,
  taskList: 60,
} as const;
