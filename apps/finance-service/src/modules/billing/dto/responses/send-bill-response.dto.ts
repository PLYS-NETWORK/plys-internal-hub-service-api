import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

export interface ISendBillResponse {
  readonly invoice_id: string;
  readonly notified_at: Date;
}

@Exclude()
export class SendBillResponseDto implements ISendBillResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly invoice_id!: string;

  @Expose()
  @ApiProperty({ example: '2026-05-01T08:10:00.000Z' })
  public readonly notified_at!: Date;
}
