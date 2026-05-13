import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUppercase,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ISubmitOnboardingProfileRequest } from './interfaces/submit-onboarding-profile.request.interface';

export class SubmitOnboardingProfileDto implements ISubmitOnboardingProfileRequest {
  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({
    example: 'Senior full-stack engineer with 7 years building SaaS products.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  public readonly bio!: string;

  @Expose()
  @ApiProperty({ name: 'years_of_experience', example: 7 })
  @IsInt()
  @Min(0)
  @Max(50)
  public readonly years_of_experience!: number;

  @Expose()
  @ApiProperty({ name: 'phone_number', example: '+905551234567' })
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  public readonly phone_number!: string;

  @Expose()
  @ApiProperty({ name: 'country_code', example: 'TR', description: 'ISO 3166-1 alpha-2 code' })
  @IsString()
  @Length(2, 2)
  @IsUppercase()
  public readonly country_code!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'avatar_url', example: 'https://cdn.example.com/u/jane.jpg' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  public readonly avatar_url?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'cv_url', example: 'https://cdn.example.com/u/jane-cv.pdf' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  public readonly cv_url?: string;
}
