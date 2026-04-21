import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsUrl, IsUUID } from 'class-validator';

import { ISettleInvoiceRequest } from './interfaces/settle-invoice.request.interface';

export class SettleInvoiceDto implements ISettleInvoiceRequest {
  @Expose({ name: 'invoice_id' })
  @ApiProperty({
    name: 'invoice_id',
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the invoice to pay',
  })
  @IsUUID()
  public readonly invoiceId!: string;

  @Expose({ name: 'success_url' })
  @ApiProperty({
    name: 'success_url',
    example: 'https://example.com/billing/success',
    description: 'URL to redirect after successful payment',
  })
  @IsUrl()
  public readonly successUrl!: string;

  @Expose({ name: 'cancel_url' })
  @ApiProperty({
    name: 'cancel_url',
    example: 'https://example.com/billing/cancel',
    description: 'URL to redirect if payment is cancelled',
  })
  @IsUrl()
  public readonly cancelUrl!: string;
}
