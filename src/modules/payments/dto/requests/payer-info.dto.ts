import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

import { BillingAddressDto } from './billing-address.dto';
import { IPayerInfoRequest } from './interfaces/payer-info.request.interface';

export class PayerInfoDto implements IPayerInfoRequest {
  @Expose()
  @ApiProperty({ name: 'name', example: 'Jane Doe', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public readonly name!: string;

  @Expose()
  @ApiProperty({ name: 'email', example: 'jane@example.com' })
  @IsEmail()
  public readonly email!: string;

  @Expose({ name: 'billing_address' })
  @ApiProperty({ name: 'billing_address', type: BillingAddressDto })
  @ValidateNested()
  @Type(() => BillingAddressDto)
  public readonly billingAddress!: BillingAddressDto;
}
