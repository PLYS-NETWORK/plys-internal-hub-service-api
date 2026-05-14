import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, IsUppercase, Length, Matches } from 'class-validator';

import { IOnboardBusinessProfileRequest } from './interfaces/onboard-business-profile.request.interface';

export class OnboardBusinessProfileDto implements IOnboardBusinessProfileRequest {
  @Expose()
  @ApiProperty({ name: 'company_name', example: 'Acme Corp' })
  @IsString()
  public readonly company_name!: string;

  @Expose()
  @ApiProperty({
    name: 'tax_id',
    example: '1234567890',
    description: 'Tax identification number; alphanumeric with optional dashes, 5–32 chars.',
  })
  @IsString()
  @Length(5, 32)
  @Matches(/^[A-Z0-9-]+$/i, {
    message: 'tax_id must be alphanumeric with optional dashes',
  })
  public readonly tax_id!: string;

  @Expose()
  @ApiProperty({ name: 'industry', example: 'Technology' })
  @IsString()
  public readonly industry!: string;

  @Expose()
  @ApiProperty({ name: 'company_size', example: '11-50' })
  @IsString()
  public readonly company_size!: string;

  @Expose()
  @ApiProperty({ name: 'address_line', example: '123 Main St' })
  @IsString()
  public readonly address_line!: string;

  @Expose()
  @ApiProperty({ name: 'city', example: 'San Francisco' })
  @IsString()
  public readonly city!: string;

  @Expose()
  @ApiProperty({ name: 'state_province', example: 'California' })
  @IsString()
  public readonly state_province!: string;

  @Expose()
  @ApiProperty({ name: 'postal_code', example: '94105' })
  @IsString()
  public readonly postal_code!: string;

  @Expose()
  @ApiProperty({ name: 'country_code', example: 'US', description: 'ISO 3166-1 alpha-2 code' })
  @IsString()
  @Length(2, 2)
  @IsUppercase()
  public readonly country_code!: string;

  @Expose()
  @ApiProperty({ name: 'phone_number', example: '+14155552671' })
  @IsString()
  public readonly phone_number!: string;
}
