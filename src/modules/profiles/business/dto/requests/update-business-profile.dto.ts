import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, IsUppercase, Length, Matches } from 'class-validator';

import { IUpdateBusinessProfileRequest } from './interfaces/update-business-profile.request.interface';

export class UpdateBusinessProfileDto implements IUpdateBusinessProfileRequest {
  @Expose()
  @ApiPropertyOptional({ name: 'company_name', example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  public readonly company_name?: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'tax_id',
    example: '1234567890',
    description: 'Tax identification number; alphanumeric with optional dashes, 5–32 chars.',
  })
  @IsOptional()
  @IsString()
  @Length(5, 32)
  @Matches(/^[A-Z0-9-]+$/i, { message: 'tax_id must be alphanumeric with optional dashes' })
  public readonly tax_id?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'industry', example: 'Technology' })
  @IsOptional()
  @IsString()
  public readonly industry?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'company_size', example: '11-50' })
  @IsOptional()
  @IsString()
  public readonly company_size?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'address_line', example: '123 Main St' })
  @IsOptional()
  @IsString()
  public readonly address_line?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'city', example: 'San Francisco' })
  @IsOptional()
  @IsString()
  public readonly city?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'state_province', example: 'California' })
  @IsOptional()
  @IsString()
  public readonly state_province?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'postal_code', example: '94105' })
  @IsOptional()
  @IsString()
  public readonly postal_code?: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'country_code',
    example: 'US',
    description: 'ISO 3166-1 alpha-2 code',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @IsUppercase()
  public readonly country_code?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'phone_number', example: '+14155552671' })
  @IsOptional()
  @IsString()
  public readonly phone_number?: string;
}
