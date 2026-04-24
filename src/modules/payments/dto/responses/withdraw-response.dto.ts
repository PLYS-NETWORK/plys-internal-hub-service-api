import { TransactionStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IWithdrawResponse } from './interfaces/withdraw.response.interface';

@Exclude()
export class WithdrawResponseDto implements IWithdrawResponse {
  @Expose()
  @ApiProperty({ example: true })
  public readonly is_connected!: boolean;

  @Expose()
  @ApiPropertyOptional({ example: 'https://connect.stripe.com/...' })
  public readonly onboarding_url!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly transaction_id!: string | null;

  @Expose()
  @ApiPropertyOptional({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  public readonly status!: TransactionStatus | null;
}
