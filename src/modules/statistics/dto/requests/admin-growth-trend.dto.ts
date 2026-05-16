import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

import {
  AdminGrowthTrendGranularity,
  IAdminGrowthTrendRequest,
} from './interfaces/admin-growth-trend.request.interface';

export class AdminGrowthTrendDto implements IAdminGrowthTrendRequest {
  @Expose({ name: 'from' })
  @ApiPropertyOptional({
    name: 'from',
    example: '2026-01-01T00:00:00.000Z',
    description: 'Inclusive lower bound on `created_at`.',
  })
  @IsISO8601()
  @IsOptional()
  public readonly from?: string;

  @Expose({ name: 'to' })
  @ApiPropertyOptional({
    name: 'to',
    example: '2026-05-01T00:00:00.000Z',
    description: 'Inclusive upper bound on `created_at`.',
  })
  @IsISO8601()
  @IsOptional()
  public readonly to?: string;

  @Expose({ name: 'granularity' })
  @ApiPropertyOptional({
    name: 'granularity',
    enum: ['month', 'week'],
    default: 'month',
    description: 'Bucket size for the time series.',
  })
  @IsEnum(['month', 'week'])
  @IsOptional()
  public readonly granularity: AdminGrowthTrendGranularity = 'month';
}
