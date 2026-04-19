import { ConsultantAvailability } from '@database/enums/consultant-availability.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
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
import { IOnboardConsultantProfileRequest } from './interfaces/onboard-consultant-profile.request.interface';

export class OnboardConsultantProfileDto implements IOnboardConsultantProfileRequest {
  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Jane Doe' })
  @IsString()
  @MaxLength(255)
  public readonly full_name!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'bio', example: 'Senior software engineer with 10 years of experience.' })
  @IsString()
  @IsOptional()
  public readonly bio?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'years_of_experience', example: 5 })
  @IsInt()
  @Min(0)
  @IsOptional()
  public readonly years_of_experience?: number;

  @Expose()
  @ApiPropertyOptional({ name: 'availability', enum: ConsultantAvailability, example: ConsultantAvailability.FULL_TIME })
  @IsEnum(ConsultantAvailability)
  @IsOptional()
  public readonly availability?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'address_line', example: '456 Elm Street' })
  @IsString()
  @IsOptional()
  public readonly address_line?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'city', example: 'New York' })
  @IsString()
  @IsOptional()
  public readonly city?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'state_province', example: 'New York' })
  @IsString()
  @IsOptional()
  public readonly state_province?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'postal_code', example: '10001' })
  @IsString()
  @IsOptional()
  public readonly postal_code?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'country_code', example: 'US', description: 'ISO 3166-1 alpha-2 code' })
  @IsString()
  @Length(2, 2)
  @IsUppercase()
  @IsOptional()
  public readonly country_code?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'phone_number', example: '+12125552671' })
  @IsString()
  @IsOptional()
  public readonly phone_number?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'skills', type: [ConsultantSkillInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsultantSkillInputDto)
  @IsOptional()
  public readonly skills?: ConsultantSkillInputDto[];
}
