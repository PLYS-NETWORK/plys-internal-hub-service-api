import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsISO31661Alpha2, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IBillingAddressRequest } from './interfaces/billing-address.request.interface';

export class BillingAddressDto implements IBillingAddressRequest {
  @Expose()
  @ApiProperty({ name: 'line1', example: '123 Sukhumvit Rd', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public readonly line1!: string;

  @Expose()
  @ApiProperty({ name: 'line2', example: 'Suite 5B', required: false, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly line2?: string;

  @Expose()
  @ApiProperty({ name: 'city', example: 'Bangkok', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public readonly city!: string;

  @Expose()
  @ApiProperty({ name: 'state', example: 'Bangkok', required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly state?: string;

  @Expose({ name: 'postal_code' })
  @ApiProperty({ name: 'postal_code', example: '10110', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  public readonly postalCode!: string;

  @Expose()
  @ApiProperty({ name: 'country', example: 'TH', description: 'ISO 3166-1 alpha-2 country code' })
  @IsISO31661Alpha2()
  public readonly country!: string;
}
