import { ConsultantTransactionType, TransactionStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantTransactionResponse } from './interfaces/consultant-transaction.response.interface';

@Exclude()
export class ConsultantTransactionResponseDto implements IConsultantTransactionResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: ConsultantTransactionType, example: ConsultantTransactionType.WITHDRAWAL })
  public readonly type!: ConsultantTransactionType;

  @Expose()
  @ApiProperty({ example: '100.00' })
  public readonly amount!: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  public readonly status!: TransactionStatus;

  @Expose()
  @ApiPropertyOptional({ example: 'stripe_connect' })
  public readonly withdrawal_method!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'Withdrawal to connected Stripe account' })
  public readonly note!: string | null;

  @Expose()
  @ApiProperty({ example: '2026-04-20T12:00:00.000Z' })
  public readonly created_at!: Date;
}
