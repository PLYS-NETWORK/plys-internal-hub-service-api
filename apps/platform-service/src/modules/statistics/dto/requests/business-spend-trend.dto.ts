import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

import {
  BusinessSpendGranularity,
  IBusinessSpendTrendRequest,
} from './interfaces/business-spend-trend.request.interface';

export class BusinessSpendTrendDto implements IBusinessSpendTrendRequest {
  @Expose({ name: 'from' })
  @ApiPropertyOptional({ name: 'from', example: '2026-01-01T00:00:00.000Z' })
  @IsISO8601()
  @IsOptional()
  public readonly from?: string;

  @Expose({ name: 'to' })
  @ApiPropertyOptional({ name: 'to', example: '2026-05-01T00:00:00.000Z' })
  @IsISO8601()
  @IsOptional()
  public readonly to?: string;

  @Expose({ name: 'granularity' })
  @ApiPropertyOptional({ name: 'granularity', enum: ['month', 'week'], default: 'month' })
  @IsEnum(['month', 'week'])
  @IsOptional()
  public readonly granularity: BusinessSpendGranularity = 'month';
}
