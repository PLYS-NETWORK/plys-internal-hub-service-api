import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

import { ICreateWithdrawRequest } from './interfaces/create-withdraw.request.interface';

export class CreateWithdrawDto implements ICreateWithdrawRequest {
  @Expose()
  @ApiProperty({
    name: 'amount',
    example: 50,
    minimum: 10,
    description: 'Amount in USD to withdraw',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  public readonly amount!: number;
}
