import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IBillingAddressResponse,
  IPayerInfoResponse,
} from './interfaces/payer-info.response.interface';

@Exclude()
export class BillingAddressResponseDto implements IBillingAddressResponse {
  @Expose()
  @ApiProperty({ example: '123 Sukhumvit Rd' })
  public readonly line1!: string;

  @Expose()
  @ApiProperty({ example: 'Suite 5B', nullable: true })
  public readonly line2!: string | null;

  @Expose()
  @ApiProperty({ example: 'Bangkok' })
  public readonly city!: string;

  @Expose()
  @ApiProperty({ example: 'Bangkok', nullable: true })
  public readonly state!: string | null;

  @Expose()
  @ApiProperty({ name: 'postal_code', example: '10110' })
  public readonly postal_code!: string;

  @Expose()
  @ApiProperty({ example: 'TH', description: 'ISO 3166-1 alpha-2 country code' })
  public readonly country!: string;
}

@Exclude()
export class PayerInfoResponseDto implements IPayerInfoResponse {
  @Expose()
  @ApiProperty({ example: 'Jane Doe' })
  public readonly name!: string;

  @Expose()
  @ApiProperty({ example: 'jane@example.com' })
  public readonly email!: string;

  @Expose()
  @Type(() => BillingAddressResponseDto)
  @ApiProperty({ name: 'billing_address', type: BillingAddressResponseDto })
  public readonly billing_address!: BillingAddressResponseDto;
}
