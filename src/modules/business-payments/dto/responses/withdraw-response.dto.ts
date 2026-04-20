import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IWithdrawResponse } from './interfaces/withdraw.response.interface';

@Exclude()
export class WithdrawResponseDto implements IWithdrawResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly transaction_id!: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  public readonly status!: TransactionStatus;
}
