import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IBillingDraftRatioResponse } from './interfaces/billing-draft-ratio.response.interface';

@Exclude()
export class BillingDraftRatioResponseDto implements IBillingDraftRatioResponse {
  @Expose()
  @ApiProperty({ name: 'draft_count', example: 8 })
  public readonly draft_count!: number;

  @Expose()
  @ApiProperty({ name: 'published_count', example: 12 })
  public readonly published_count!: number;

  @Expose()
  @ApiProperty({ name: 'total_count', example: 20 })
  public readonly total_count!: number;

  @Expose()
  @ApiProperty({ name: 'draft_ratio', example: 0.4 })
  public readonly draft_ratio!: number;

  @Expose()
  @ApiProperty({ name: 'published_ratio', example: 0.6 })
  public readonly published_ratio!: number;

  @Expose()
  @ApiProperty({ name: 'potential_revenue', example: '560.00' })
  public readonly potential_revenue!: string;

  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;
}
