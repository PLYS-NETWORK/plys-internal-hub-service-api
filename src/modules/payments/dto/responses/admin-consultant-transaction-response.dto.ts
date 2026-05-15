import { ConsultantTransactionType, TransactionStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { AdminTransactionOwnerResponseDto } from './admin-transaction-owner-response.dto';
import { IAdminConsultantTransactionResponse } from './interfaces/admin-consultant-transaction.response.interface';

@Exclude()
export class AdminConsultantTransactionResponseDto implements IAdminConsultantTransactionResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'transaction_number', example: 'LNWDR202604200001' })
  public readonly transaction_number!: string;

  @Expose()
  @ApiProperty({ enum: ConsultantTransactionType, example: ConsultantTransactionType.WITHDRAWAL })
  public readonly type!: ConsultantTransactionType;

  @Expose()
  @ApiProperty({ example: '100.00' })
  public readonly amount!: string;

  @Expose()
  @ApiProperty({ name: 'commission_rate', example: '0.0000' })
  public readonly commission_rate!: string;

  @Expose()
  @ApiProperty({ name: 'commission_amount', example: '0.00' })
  public readonly commission_amount!: string;

  @Expose()
  @ApiProperty({ name: 'total_amount', example: '100.00' })
  public readonly total_amount!: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  public readonly status!: TransactionStatus;

  @Expose()
  @ApiPropertyOptional({ name: 'withdrawal_method', example: 'stripe_connect', nullable: true })
  public readonly withdrawal_method!: string | null;

  @Expose()
  @ApiPropertyOptional({
    example: 'Withdrawal to connected Stripe account',
    nullable: true,
  })
  public readonly note!: string | null;

  @Expose()
  @ApiProperty({
    name: 'created_at',
    example: '2026-04-20T19:00:00.000+07:00',
    description: "ISO 8601 in the caller's resolved timezone.",
  })
  public readonly created_at!: string;

  @Expose()
  @Type(() => AdminTransactionOwnerResponseDto)
  @ApiProperty({ type: AdminTransactionOwnerResponseDto })
  public readonly owner!: AdminTransactionOwnerResponseDto;
}
