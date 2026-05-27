import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNumber, IsUrl, Min } from 'class-validator';

import { ICreateWithdrawRequest } from './interfaces/create-withdraw.request.interface';

export class CreateWithdrawDto implements ICreateWithdrawRequest {
  @Expose()
  @ApiProperty({
    name: 'amount',
    example: 100,
    minimum: 50,
    description: 'Amount in USD to withdraw (minimum $50)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(50)
  public readonly amount!: number;

  @Expose({ name: 'success_url' })
  @ApiProperty({
    name: 'success_url',
    example: 'https://example.com/payments/withdraw/success',
    description: 'URL to redirect after successful withdrawal or Stripe Connect onboarding',
  })
  @IsUrl({ require_tld: false })
  public readonly successUrl!: string;

  @Expose({ name: 'cancel_url' })
  @ApiProperty({
    name: 'cancel_url',
    example: 'https://example.com/payments/withdraw/cancel',
    description: 'URL to redirect if withdrawal or Stripe Connect onboarding is cancelled',
  })
  @IsUrl({ require_tld: false })
  public readonly cancelUrl!: string;
}
