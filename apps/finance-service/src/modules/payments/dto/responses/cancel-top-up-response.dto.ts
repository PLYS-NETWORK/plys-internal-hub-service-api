import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose } from 'class-transformer';

import { ICancelTopUpResponse } from './interfaces/cancel-top-up.response.interface';

@Exclude()
export class CancelTopUpResponseDto implements ICancelTopUpResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly transaction_id!: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.FAILED })
  public readonly status!: TransactionStatus;
}
