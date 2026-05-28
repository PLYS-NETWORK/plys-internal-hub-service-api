import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsUUID } from 'class-validator';

import { ITransactionIdParamRequest } from './interfaces/transaction-id-param.request.interface';

export class TransactionIdParamDto implements ITransactionIdParamRequest {
  @Expose({ name: 'transaction_id' })
  @ApiProperty({
    name: 'transaction_id',
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the pending top-up transaction',
  })
  @IsUUID()
  public readonly transactionId!: string;
}
