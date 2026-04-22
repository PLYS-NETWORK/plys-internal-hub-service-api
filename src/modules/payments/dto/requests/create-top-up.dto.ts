import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNumber, IsUrl, Min } from 'class-validator';

import { ICreateTopUpRequest } from './interfaces/create-top-up.request.interface';

export class CreateTopUpDto implements ICreateTopUpRequest {
  @Expose()
  @ApiProperty({ name: 'amount', example: 100, minimum: 10, description: 'Amount in USD' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  public readonly amount!: number;

  @Expose({ name: 'success_url' })
  @ApiProperty({
    name: 'success_url',
    example: 'https://example.com/payment/success',
    description: 'URL to redirect after successful payment',
  })
  @IsUrl({ require_tld: false })
  public readonly successUrl!: string;

  @Expose({ name: 'cancel_url' })
  @ApiProperty({
    name: 'cancel_url',
    example: 'https://example.com/payment/cancel',
    description: 'URL to redirect if payment is cancelled',
  })
  @IsUrl({ require_tld: false })
  public readonly cancelUrl!: string;
}
