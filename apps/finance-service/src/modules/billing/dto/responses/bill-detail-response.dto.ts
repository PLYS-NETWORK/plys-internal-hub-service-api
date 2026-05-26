import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingPeriodStatus, InvoiceStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBillDetailResponse,
  IBillInvoiceDetailResponse,
  IBillLineItemResponse,
} from './interfaces/bill-detail.response.interface';

@Exclude()
export class BillLineItemResponseDto implements IBillLineItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly task_id!: string;

  @Expose()
  @ApiProperty({ example: 'Implement authentication module' })
  public readonly task_title!: string;

  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ example: 'E-commerce Platform' })
  public readonly project_title!: string;

  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly consultant_id!: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Task settlement' })
  public readonly description!: string | null;

  @Expose()
  @ApiProperty({ example: '100.00' })
  public readonly amount!: string;

  @Expose()
  @ApiProperty({ example: '25.00' })
  public readonly platform_fee_amount!: string;

  @Expose()
  @ApiProperty({ example: '75.00' })
  public readonly consultant_payout!: string;
}

@Exclude()
export class BillInvoiceDetailResponseDto implements IBillInvoiceDetailResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: '1000.00', description: 'Task subtotal before commission' })
  public readonly task_total!: string;

  @Expose()
  @ApiProperty({ example: '0.2500', description: 'Commission rate snapshot (e.g. 0.2500 = 25%)' })
  public readonly commission_rate!: string;

  @Expose()
  @ApiProperty({
    example: '250.00',
    description: 'Commission amount = task_total × commission_rate',
  })
  public readonly commission_amount!: string;

  @Expose()
  @ApiProperty({ example: '1250.00', description: 'Total = task_total + commission_amount' })
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

  @Expose()
  @ApiPropertyOptional({ example: '2026-05-01T08:10:00.000Z' })
  public readonly notified_at!: Date | null;

  @Expose()
  @ApiPropertyOptional({ example: 'polar' })
  public readonly processor_name!: string | null;

  @Expose()
  @ApiPropertyOptional({ example: 'https://checkout.polar.sh/...' })
  public readonly processor_payment_url!: string | null;

  @Expose()
  @ApiProperty({ type: () => [BillLineItemResponseDto] })
  @Type(() => BillLineItemResponseDto)
  public readonly line_items!: BillLineItemResponseDto[];
}

@Exclude()
export class BillDetailResponseDto implements IBillDetailResponse {
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
  @ApiPropertyOptional({ type: () => BillInvoiceDetailResponseDto })
  @Type(() => BillInvoiceDetailResponseDto)
  public readonly invoice!: BillInvoiceDetailResponseDto | null;
}
