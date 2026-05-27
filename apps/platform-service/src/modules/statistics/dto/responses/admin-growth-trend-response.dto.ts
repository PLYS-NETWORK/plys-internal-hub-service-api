import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IAdminGrowthTrendPoint,
  IAdminGrowthTrendResponse,
} from './interfaces/admin-growth-trend.response.interface';

@Exclude()
export class AdminGrowthTrendPointDto implements IAdminGrowthTrendPoint {
  @Expose()
  @ApiProperty({ name: 'period_label', example: '2026-04' })
  public readonly period_label!: string;

  @Expose()
  @ApiProperty({ name: 'new_consultants', example: 42 })
  public readonly new_consultants!: number;

  @Expose()
  @ApiProperty({ name: 'new_businesses', example: 9 })
  public readonly new_businesses!: number;

  @Expose()
  @ApiProperty({ example: '215300.00' })
  public readonly gmv!: string;

  @Expose()
  @ApiProperty({ example: '98410.00' })
  public readonly payouts!: string;
}

@Exclude()
export class AdminGrowthTrendResponseDto implements IAdminGrowthTrendResponse {
  @Expose()
  @ApiProperty({ enum: ['month', 'week'], example: 'month' })
  public readonly granularity!: 'month' | 'week';

  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @Type(() => AdminGrowthTrendPointDto)
  @ApiProperty({ type: AdminGrowthTrendPointDto, isArray: true })
  public readonly points!: AdminGrowthTrendPointDto[];
}
