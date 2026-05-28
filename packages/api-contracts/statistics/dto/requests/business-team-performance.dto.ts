import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

import {
  BusinessTeamPerformanceSort,
  IBusinessTeamPerformanceRequest,
} from './interfaces/business-team-performance.request.interface';

const SORT_VALUES: readonly BusinessTeamPerformanceSort[] = [
  'completed_tasks_desc',
  'on_time_pct_desc',
  'avg_cycle_asc',
];

export class BusinessTeamPerformanceDto implements IBusinessTeamPerformanceRequest {
  @Expose({ name: 'from' })
  @ApiPropertyOptional({ name: 'from', example: '2026-05-01T00:00:00.000Z' })
  @IsISO8601()
  @IsOptional()
  public readonly from?: string;

  @Expose({ name: 'to' })
  @ApiPropertyOptional({ name: 'to', example: '2026-05-31T23:59:59.999Z' })
  @IsISO8601()
  @IsOptional()
  public readonly to?: string;

  @Expose({ name: 'limit' })
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  public readonly limit: number = 20;

  @Expose({ name: 'sort' })
  @ApiPropertyOptional({ enum: SORT_VALUES, default: 'completed_tasks_desc' })
  @IsEnum(SORT_VALUES)
  @IsOptional()
  public readonly sort: BusinessTeamPerformanceSort = 'completed_tasks_desc';
}
