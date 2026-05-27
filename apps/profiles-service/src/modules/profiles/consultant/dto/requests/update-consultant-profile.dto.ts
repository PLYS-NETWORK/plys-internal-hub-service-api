import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUppercase,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { ConsultantSkillInputDto } from './consultant-skill-input.dto';
import { IUpdateConsultantProfileRequest } from './interfaces/update-consultant-profile.request.interface';

export class UpdateConsultantProfileDto implements IUpdateConsultantProfileRequest {
  @Expose()
  @ApiPropertyOptional({ name: 'full_name', example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly full_name?: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'bio',
    example: 'Senior software engineer with 10 years of experience.',
  })
  @IsOptional()
  @IsString()
  public readonly bio?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'years_of_experience', example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public readonly years_of_experience?: number;

  @Expose()
  @ApiPropertyOptional({ name: 'address_line', example: '456 Elm Street' })
  @IsOptional()
  @IsString()
  public readonly address_line?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'city', example: 'New York' })
  @IsOptional()
  @IsString()
  public readonly city?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'state_province', example: 'New York' })
  @IsOptional()
  @IsString()
  public readonly state_province?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'postal_code', example: '10001' })
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
  @ApiPropertyOptional({ name: 'phone_number', example: '+12125552671' })
  @IsOptional()
  @IsString()
  public readonly phone_number?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'skills', type: [ConsultantSkillInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsultantSkillInputDto)
  public readonly skills?: ConsultantSkillInputDto[];
}
