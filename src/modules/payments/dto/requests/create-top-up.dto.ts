import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsNumber, IsUrl, Min, ValidateNested } from 'class-validator';

import { ICreateTopUpRequest } from './interfaces/create-top-up.request.interface';
import { PayerInfoDto } from './payer-info.dto';

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

  @Expose({ name: 'payer_info' })
  @ApiProperty({ name: 'payer_info', type: PayerInfoDto })
  @ValidateNested()
  @Type(() => PayerInfoDto)
  public readonly payerInfo!: PayerInfoDto;
}
