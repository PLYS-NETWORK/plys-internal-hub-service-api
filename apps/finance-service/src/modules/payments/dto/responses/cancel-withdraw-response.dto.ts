import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose } from 'class-transformer';

import { ICancelWithdrawResponse } from './interfaces/cancel-withdraw.response.interface';

@Exclude()
export class CancelWithdrawResponseDto implements ICancelWithdrawResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly transaction_id!: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.FAILED })
  public readonly status!: TransactionStatus;

  @Expose()
  @ApiProperty({ example: '250.00' })
  public readonly restored_amount!: string;
}
