import { BillingPeriodStatus, InvoiceStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBillInvoiceSummaryResponse,
  IBillListResponse,
} from './interfaces/bill-list.response.interface';

@Exclude()
export class BillInvoiceSummaryResponseDto implements IBillInvoiceSummaryResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: '1250.00' })
  public readonly amount!: string;

  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.PENDING })
  public readonly status!: InvoiceStatus;

  @Expose()
  @ApiPropertyOptional({ example: '2026-05-15' })
  public readonly due_date!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: '2026-05-10T08:00:00.000Z' })
  public readonly paid_at!: Date | null;
}

@Exclude()
export class BillListResponseDto implements IBillListResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly business_id!: string;

  @Expose()
  @ApiProperty({ example: '2026-04-01' })
  public readonly period_start!: string;

  @Expose()
  @ApiProperty({ example: '2026-04-30' })
  public readonly period_end!: string;

  @Expose()
  @ApiProperty({ enum: BillingPeriodStatus, example: BillingPeriodStatus.FINALIZED })
  public readonly status!: BillingPeriodStatus;

  @Expose()
  @ApiProperty({ example: '1250.00' })
  public readonly total_amount!: string;

  @Expose()
  @ApiPropertyOptional({ example: '2026-05-01T08:00:00.000Z' })
  public readonly finalized_at!: Date | null;

  @Expose()
  @ApiPropertyOptional({ type: () => BillInvoiceSummaryResponseDto })
  @Type(() => BillInvoiceSummaryResponseDto)
  public readonly invoice!: BillInvoiceSummaryResponseDto | null;
}
