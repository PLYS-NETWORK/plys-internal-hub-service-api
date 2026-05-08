import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { GetMilestonesDto } from '../../dto/requests/get-milestones.dto';
import { BoardMilestonesResponseDto } from '../../dto/responses/board-milestones-response.dto';
import { IBoardMilestonesService } from '../../interfaces/board-milestones.service.interface';
import { BusinessAccessService } from '../business-access.service';
import { BoardCacheService } from './board-cache.service';

interface IStatusCountRow {
  kanban_status: string;
  count: number;
}

@Injectable()
export class BoardMilestonesService implements IBoardMilestonesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly cache: BoardCacheService,
  ) {
    this.logger = new AppLogger(BoardMilestonesService.name, requestContext);
  }

  /** @inheritdoc */
  public async getSummary(
    projectId: string,
    filters: GetMilestonesDto,
  ): Promise<BoardMilestonesResponseDto> {
    const userId = this.requestContext.userId!;
    const tz = this.requestContext.timezone ?? 'UTC';
    this.logger.log(
      `getSummary — start | projectId: ${projectId}, removeCache: ${filters.isRemoveCache ?? false}`,
    );
    await this.access.resolveOwnedProject(projectId);

    // Keyed with a fixed digest so invalidateProject(projectId) wipes this
    // entry alongside the task-list pages when tasks are mutated.
    const cacheKey = this.cache.buildKey(projectId, userId, tz, { type: 'milestones' });

    if (!filters.isRemoveCache) {
      const cached = await this.cache.get<BoardMilestonesResponseDto>(cacheKey);
      if (cached) {
        this.logger.log(`getSummary — cache hit | key: ${cacheKey}`);
        return plainToInstance(BoardMilestonesResponseDto, cached, {
          excludeExtraneousValues: true,
        });
      }
    } else {
      await this.cache.invalidateKey(cacheKey);
    }

    const rows = await this.uow.tasks
      .createQueryBuilder('t')
      .select('t.kanban_status', 'kanban_status')
      .addSelect('COUNT(*)::int', 'count')
      .where('t.project_id = :projectId', { projectId })
      .andWhere('t.kanban_status != :draft', { draft: TaskKanbanStatus.DRAFT })
      .andWhere('t.deleted_at IS NULL')
      .groupBy('t.kanban_status')
      .getRawMany<IStatusCountRow>();

    const counts = new Map(rows.map((r) => [r.kanban_status, r.count]));
    const totalTasks = rows.reduce((sum, r) => sum + r.count, 0);

    const result = plainToInstance(
      BoardMilestonesResponseDto,
      {
        total_tasks: totalTasks,
        total_to_do: counts.get(TaskKanbanStatus.TO_DO) ?? 0,
        total_assigned: counts.get(TaskKanbanStatus.ASSIGNED) ?? 0,
        total_in_progress: counts.get(TaskKanbanStatus.IN_PROGRESS) ?? 0,
        total_in_review: counts.get(TaskKanbanStatus.IN_REVIEW) ?? 0,
        total_pending_approval: counts.get(TaskKanbanStatus.PENDING_APPROVAL) ?? 0,
        total_revision_requested: counts.get(TaskKanbanStatus.REVISION_REQUESTED) ?? 0,
        total_done: counts.get(TaskKanbanStatus.DONE) ?? 0,
        total_cancelled: counts.get(TaskKanbanStatus.CANCELLED) ?? 0,
      },
      { excludeExtraneousValues: true },
    );

    await this.cache.set(cacheKey, result);
    this.logger.log(
      `getSummary — complete | projectId: ${projectId}, total: ${totalTasks}, cached: true`,
    );
    return result;
  }
}
