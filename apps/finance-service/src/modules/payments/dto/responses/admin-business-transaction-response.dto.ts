import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessTransactionType, TransactionStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import { AdminTransactionOwnerResponseDto } from './admin-transaction-owner-response.dto';
import { IAdminBusinessTransactionResponse } from './interfaces/admin-business-transaction.response.interface';
import { PayerInfoResponseDto } from './payer-info-response.dto';

@Exclude()
export class AdminBusinessTransactionResponseDto implements IAdminBusinessTransactionResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'transaction_number', example: 'PLSTOP202604200001' })
  public readonly transaction_number!: string;

  @Expose()
  @ApiProperty({ enum: BusinessTransactionType, example: BusinessTransactionType.TOP_UP })
  public readonly type!: BusinessTransactionType;

  @Expose()
  @ApiProperty({ example: '100.00' })
  public readonly amount!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'commission_rate', example: '0.1500', nullable: true })
  public readonly commission_rate!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'commission_amount', example: '15.00', nullable: true })
  public readonly commission_amount!: string | null;

  @Expose()
  @ApiProperty({ name: 'total_amount', example: '115.00' })
  public readonly total_amount!: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  public readonly status!: TransactionStatus;

  @Expose()
  @ApiPropertyOptional({ example: 'Top-up via Polar checkout', nullable: true })
  public readonly note!: string | null;

  @Expose()
  @Type(() => PayerInfoResponseDto)
  @ApiPropertyOptional({ name: 'payer_info', type: PayerInfoResponseDto, nullable: true })
  public readonly payer_info!: PayerInfoResponseDto | null;

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
