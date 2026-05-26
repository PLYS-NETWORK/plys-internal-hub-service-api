import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBusinessSpendTrendPointResponse,
  IBusinessSpendTrendResponse,
} from './interfaces/business-spend-trend.response.interface';

@Exclude()
export class BusinessSpendTrendPointDto implements IBusinessSpendTrendPointResponse {
  @Expose()
  @ApiProperty({ name: 'period_label', example: '2026-04' })
  public readonly period_label!: string;
  @Expose()
  @ApiProperty({ example: '4170.00' })
  public readonly spend!: string;
  @Expose()
  @ApiProperty({ example: '6480.00' })
  public readonly cumulative!: string;
}

@Exclude()
export class BusinessSpendTrendResponseDto implements IBusinessSpendTrendResponse {
  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ enum: ['month', 'week'], example: 'month' })
  public readonly granularity!: 'month' | 'week';

  @Expose()
  @Type(() => BusinessSpendTrendPointDto)
  @ApiProperty({ type: BusinessSpendTrendPointDto, isArray: true })
  public readonly points!: BusinessSpendTrendPointDto[];
}
