import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

import { IProjectsTrendRequest } from './interfaces/projects-trend.request.interface';
import { StatsDateRangeDto } from './stats-date-range.dto';

export enum TrendPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class ProjectsTrendDto extends StatsDateRangeDto implements IProjectsTrendRequest {
  @Expose({ name: 'period' })
  @ApiPropertyOptional({ name: 'period', enum: TrendPeriod, default: TrendPeriod.MONTHLY })
  @IsEnum(TrendPeriod)
  @IsOptional()
  public readonly period: TrendPeriod = TrendPeriod.MONTHLY;
}
