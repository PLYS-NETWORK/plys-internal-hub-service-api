import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { UrlResolverService } from '@plys/libraries/common-nest/modules/file-storage';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { IConsultantPerformanceAggregate } from '@plys/libraries/unit-of-work/repositories/tasks/interfaces';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { BusinessTeamPerformanceDto } from '../../../dto/requests/business-team-performance.dto';
import { BusinessTeamPerformanceResponseDto } from '../../../dto/responses/business-team-performance-response.dto';
import { IBusinessTeamPerformanceService } from '../interfaces/business-team-performance-service.interface';

interface IPerformanceItem {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
  active_projects_count: number;
  completed_tasks: number;
  in_progress_tasks: number;
  avg_cycle_days: string | null;
  on_time_pct: string | null;
}

@Injectable()
export class BusinessTeamPerformanceService implements IBusinessTeamPerformanceService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly urlResolver: UrlResolverService,
  ) {
    this.logger = new AppLogger(BusinessTeamPerformanceService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(dto: BusinessTeamPerformanceDto): Promise<BusinessTeamPerformanceResponseDto> {
    const userId = this.requestContext.userId!;
    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const businessId = businessProfile.id;

    const now = new Date();
    const to = dto.to ? DateUtil.toDate(dto.to) : now;
    const from = dto.from
      ? DateUtil.toDate(dto.from)
      : DateUtil.toDate(DateUtil.startOf(now, 'month'));

    this.logger.log(
      `get — start | businessId: ${businessId}, from: ${from.toISOString()}, to: ${to.toISOString()}, sort: ${dto.sort}, limit: ${dto.limit}`,
    );

    const projectIds = await this.uow.projects.findIdsByBusinessId(businessId);
    if (projectIds.length === 0) {
      return plainToInstance(
        BusinessTeamPerformanceResponseDto,
        { consultants: [], generated_at: now.toISOString() },
        { excludeExtraneousValues: true },
      );
    }

    const consultantRows = await this.uow.projectMembers.findActiveConsultantsByProjectIds(
      projectIds,
      dto.limit,
    );
    if (consultantRows.length === 0) {
      return plainToInstance(
        BusinessTeamPerformanceResponseDto,
        { consultants: [], generated_at: now.toISOString() },
        { excludeExtraneousValues: true },
      );
    }

    const consultantIds = consultantRows.map((r) => r.consultant_id);
    const perfRows = await this.uow.tasks.aggregatePerformanceByAssigneesBetween(
      projectIds,
      consultantIds,
      from,
      to,
    );
    const perfById = new Map<string, IConsultantPerformanceAggregate>(
      perfRows.map((r) => [r.consultant_id, r]),
    );

    const avatarUrls = await this.urlResolver.resolveMany(
      consultantRows.map((row) => row.avatar_url),
    );
    const items: IPerformanceItem[] = consultantRows.map((row, idx) => {
      const perf = perfById.get(row.consultant_id);
      const completed = perf?.completed ?? 0;
      const inProgress = perf?.in_progress ?? 0;
      const totalDone = perf?.total_done ?? 0;
      const onTime = perf?.on_time ?? 0;
      const avgCycle = perf?.avg_cycle_days ?? null;
      const onTimePct = totalDone > 0 ? ((onTime / totalDone) * 100).toFixed(1) : null;
      const avgCycleStr = avgCycle !== null ? avgCycle.toFixed(1) : null;
      return {
        consultant_id: row.consultant_id,
        full_name: row.full_name,
        avatar_url: avatarUrls[idx],
        active_projects_count: row.active_projects_count,
        completed_tasks: completed,
        in_progress_tasks: inProgress,
        avg_cycle_days: avgCycleStr,
        on_time_pct: onTimePct,
      };
    });

    items.sort((a, b) => this.compare(a, b, dto.sort));

    this.logger.log(`get — complete | consultants: ${items.length}`);

    return plainToInstance(
      BusinessTeamPerformanceResponseDto,
      { consultants: items, generated_at: now.toISOString() },
      { excludeExtraneousValues: true },
    );
  }

  // null-aware comparator: rows with `null` metric land last regardless of
  // sort direction so they don't crowd the top of the list with "0%".
  private compare(
    a: IPerformanceItem,
    b: IPerformanceItem,
    sort: BusinessTeamPerformanceDto['sort'],
  ): number {
    switch (sort) {
      case 'on_time_pct_desc': {
        const av = a.on_time_pct !== null ? Number(a.on_time_pct) : -1;
        const bv = b.on_time_pct !== null ? Number(b.on_time_pct) : -1;
        return bv - av;
      }
      case 'avg_cycle_asc': {
        const av = a.avg_cycle_days !== null ? Number(a.avg_cycle_days) : Number.POSITIVE_INFINITY;
        const bv = b.avg_cycle_days !== null ? Number(b.avg_cycle_days) : Number.POSITIVE_INFINITY;
        return av - bv;
      }
      case 'completed_tasks_desc':
      default:
        return b.completed_tasks - a.completed_tasks;
    }
  }
}
