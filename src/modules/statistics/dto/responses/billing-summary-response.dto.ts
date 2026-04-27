import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IBillingSummaryResponse } from './interfaces/billing-summary.response.interface';

@Exclude()
export class BillingSummaryResponseDto implements IBillingSummaryResponse {
  @Expose()
  @ApiProperty({ name: 'total_spend', example: '840.00' })
  public readonly total_spend!: string;

  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ name: 'total_published_projects', example: 12 })
  public readonly total_published_projects!: number;

  @Expose()
  @ApiProperty({ name: 'last_payment_at', nullable: true, example: '2026-04-15T09:00:00Z' })
  public readonly last_payment_at!: Date | null;
}
