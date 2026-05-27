import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ISettleInvoiceResponse } from './interfaces/settle-invoice.response.interface';

@Exclude()
export class SettleInvoiceResponseDto implements ISettleInvoiceResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly invoice_id!: string;

  @Expose()
  @ApiProperty({ example: 'https://checkout.polar.sh/...' })
  public readonly redirect_url!: string;
}
