import { BusinessTransactionType, TransactionStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITransactionResponse } from './interfaces/transaction.response.interface';

@Exclude()
export class TransactionResponseDto implements ITransactionResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: BusinessTransactionType, example: BusinessTransactionType.TOP_UP })
  public readonly type!: BusinessTransactionType;

  @Expose()
  @ApiProperty({ example: '100.00' })
  public readonly amount!: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  public readonly status!: TransactionStatus;

  @Expose()
  @ApiPropertyOptional({ example: 'Top-up via Polar checkout' })
  public readonly note!: string | null;

  @Expose()
  @ApiProperty({ example: '2026-04-20T12:00:00.000Z' })
  public readonly created_at!: Date;
}
