import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

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
}
