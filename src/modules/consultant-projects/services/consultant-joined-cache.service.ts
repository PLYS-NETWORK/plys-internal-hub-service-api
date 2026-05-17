import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Injectable } from '@nestjs/common';

import { ListConsultantJoinedProjectsDto } from '../dto/requests/list-consultant-joined-projects.dto';
import { ListConsultantProjectTasksDto } from '../dto/requests/list-consultant-project-tasks.dto';
import { ListConsultantWorkspacesDto } from '../dto/requests/list-consultant-workspaces.dto';
import { IConsultantJoinedCacheService } from '../interfaces/consultant-joined-cache.service.interface';

const KEY_PREFIX = {
  workspace: 'consultant_workspaces:list',
  joinedList: 'consultant_joined:list',
  joinedDetail: 'consultant_joined:detail',
  taskList: 'consultant_joined:tasks',
} as const;

@Injectable()
export class ConsultantJoinedCacheService implements IConsultantJoinedCacheService {
  private readonly logger: AppLogger;

  constructor(
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantJoinedCacheService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public buildWorkspaceListKey(consultantId: string, dto: ListConsultantWorkspacesDto): string {
    return `${KEY_PREFIX.workspace}:${consultantId}:${dto.page}:${dto.limit}:${this.normalizeKeyword(dto.keyword)}`;
  }

  /** @inheritdoc */
  public buildJoinedListKey(consultantId: string, dto: ListConsultantJoinedProjectsDto): string {
    return `${KEY_PREFIX.joinedList}:${consultantId}:${dto.page}:${dto.limit}:${this.normalizeKeyword(dto.keyword)}`;
  }

  /** @inheritdoc */
  public buildJoinedDetailKey(consultantId: string, projectId: string): string {
    return `${KEY_PREFIX.joinedDetail}:${consultantId}:${projectId}`;
  }

  /** @inheritdoc */
  public buildTaskListKey(
    consultantId: string,
    projectId: string,
    dto: ListConsultantProjectTasksDto,
  ): string {
    return `${KEY_PREFIX.taskList}:${consultantId}:${projectId}:${dto.page}:${dto.limit}:${this.normalizeKeyword(dto.keyword)}`;
  }

  /** @inheritdoc */
  public async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${this.rid}] read — cache read failed, falling through to DB | key: ${key}, error: ${message}`,
      );
      return null;
    }
  }

  /** @inheritdoc */
  public async write<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[${this.rid}] write — cache write failed | key: ${key}, error: ${message}`);
    }
  }

  /** @inheritdoc */
  public async invalidateForConsultantProject(
    consultantId: string,
    projectId: string,
  ): Promise<void> {
    // Pattern-delete only the caller's keys — other consultants' caches keep
    // their TTL. The workspace and joined-list keys do not include projectId
    // because the listing shape changes for any project write, so we wipe the
    // consultant-level prefixes wholesale.
    const patterns = [
      `${KEY_PREFIX.workspace}:${consultantId}:*`,
      `${KEY_PREFIX.joinedList}:${consultantId}:*`,
      `${KEY_PREFIX.joinedDetail}:${consultantId}:${projectId}`,
      `${KEY_PREFIX.taskList}:${consultantId}:${projectId}:*`,
    ];
    try {
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        for (const key of keys) await this.redis.del(key);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${this.rid}] invalidateForConsultantProject — failed, falling back to TTL | consultantId: ${consultantId}, projectId: ${projectId}, error: ${message}`,
      );
    }
  }

  private normalizeKeyword(keyword?: string): string {
    return (keyword ?? '').trim().toLowerCase();
  }
}
