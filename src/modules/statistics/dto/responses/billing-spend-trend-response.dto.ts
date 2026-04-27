import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBillingSpendTrendPoint,
  IBillingSpendTrendResponse,
} from './interfaces/billing-spend-trend.response.interface';

@Exclude()
export class BillingSpendTrendPointDto implements IBillingSpendTrendPoint {
  @Expose()
  @ApiProperty({ name: 'period_label', example: '2026-01' })
  public readonly period_label!: string;

  @Expose()
  @ApiProperty({ example: '140.00' })
  public readonly amount!: string;

  @Expose()
  @ApiProperty({ name: 'cumulative_amount', example: '420.00' })
  public readonly cumulative_amount!: string;
}

@Exclude()
export class BillingSpendTrendResponseDto implements IBillingSpendTrendResponse {
  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ type: [BillingSpendTrendPointDto] })
  @Type(() => BillingSpendTrendPointDto)
  public readonly data!: BillingSpendTrendPointDto[];
}
