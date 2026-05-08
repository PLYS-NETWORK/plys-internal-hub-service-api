import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IAdminBusinessProfileListItemResponse } from './interfaces/admin-business-profile-list-item.response.interface';

@Exclude()
export class AdminBusinessProfileListItemResponseDto implements IAdminBusinessProfileListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly user_id!: string;

  @Expose()
  @ApiProperty({ name: 'company_name', example: 'Acme Corp' })
  public readonly company_name!: string;

  @Expose()
  @ApiProperty({ example: 'owner@acme.com' })
  public readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'phone_number', nullable: true, example: '+14155552671' })
  public readonly phone_number!: string | null;

  @Expose()
  @ApiProperty({ name: 'address_line', nullable: true })
  public readonly address_line!: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly city!: string | null;

  @Expose()
  @ApiProperty({ name: 'state_province', nullable: true })
  public readonly state_province!: string | null;

  @Expose()
  @ApiProperty({ name: 'postal_code', nullable: true })
  public readonly postal_code!: string | null;

  @Expose()
  @ApiProperty({ name: 'country_code', nullable: true, example: 'US' })
  public readonly country_code!: string | null;

  @Expose()
  @ApiProperty({ name: 'is_partner_platform', example: false })
  public readonly is_partner_platform!: boolean;

  @Expose()
  @ApiProperty({ name: 'allow_payment_credit', example: false })
  public readonly allow_payment_credit!: boolean;

  @Expose()
  @ApiProperty({ name: 'is_verified', example: false })
  public readonly is_verified!: boolean;

  @Expose()
  @ApiProperty({ name: 'register_date' })
  public readonly register_date!: Date;

  @Expose()
  @ApiProperty({ name: 'last_login', nullable: true })
  public readonly last_login!: Date | null;
}
