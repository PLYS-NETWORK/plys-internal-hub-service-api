import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

import { IBusinessProfileResponse } from './interfaces/business-profile.response.interface';

@Exclude()
export class BusinessProfileResponseDto implements IBusinessProfileResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose({ name: 'userId' })
  @ApiProperty({ name: 'user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly user_id!: string;

  @Expose({ name: 'companyName' })
  @ApiProperty({ name: 'company_name', example: 'Acme Corp' })
  public readonly company_name!: string;

  @Expose({ name: 'ownerName' })
  @ApiProperty({ name: 'owner_name', example: 'John Doe', nullable: true })
  public readonly owner_name!: string | null;

  @Expose({ name: 'taxId' })
  @ApiProperty({ name: 'tax_id', example: '1234567890', nullable: true })
  public readonly tax_id!: string | null;

  @Expose()
  @ApiProperty({ example: 'Technology', nullable: true })
  public readonly industry!: string | null;

  @Expose({ name: 'companySize' })
  @ApiProperty({ name: 'company_size', example: '11-50', nullable: true })
  public readonly company_size!: string | null;

  @Expose({ name: 'websiteUrl' })
  @ApiProperty({ name: 'website_url', example: 'https://acme.com', nullable: true })
  public readonly website_url!: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly description!: string | null;

  @Expose({ name: 'addressLine' })
  @ApiProperty({ name: 'address_line', nullable: true })
  public readonly address_line!: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly city!: string | null;

  @Expose({ name: 'stateProvince' })
  @ApiProperty({ name: 'state_province', nullable: true })
  public readonly state_province!: string | null;

  @Expose({ name: 'postalCode' })
  @ApiProperty({ name: 'postal_code', nullable: true })
  public readonly postal_code!: string | null;

  @Expose({ name: 'countryCode' })
  @ApiProperty({ name: 'country_code', nullable: true })
  public readonly country_code!: string | null;

  @Expose({ name: 'phoneNumber' })
  @ApiProperty({ name: 'phone_number', nullable: true })
  public readonly phone_number!: string | null;

  @Expose()
  @ApiProperty({ name: 'timezone', example: 'Asia/Bangkok', nullable: true })
  public readonly timezone!: string | null;

  @Expose({ name: 'logoUrl' })
  @ApiProperty({ name: 'logo_url', nullable: true })
  public readonly logo_url!: string | null;

  @Expose({ name: 'isVerified' })
  @ApiProperty({ name: 'is_verified', example: false })
  public readonly is_verified!: boolean;

  @Expose({ name: 'isPartnerPlatform' })
  @ApiProperty({ name: 'is_partner_platform', example: false })
  public readonly is_partner_platform!: boolean;

  @Expose({ name: 'allowPaymentCredit' })
  @ApiProperty({ name: 'allow_payment_credit', example: false })
  public readonly allow_payment_credit!: boolean;

  @Expose({ name: 'accountBalance' })
  @Transform(({ value }: { value: string }) => parseFloat(value))
  @ApiProperty({
    name: 'account_balance',
    example: 0.0,
    description: 'Account balance (2 decimal places)',
  })
  public readonly account_balance!: number;

  @Expose({ name: 'createdAt' })
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;
}
