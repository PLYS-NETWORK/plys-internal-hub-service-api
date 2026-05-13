import { OnboardingQuestionType } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { ICreateOnboardingQuestionRequest } from './interfaces/create-onboarding-question.request.interface';
import { OnboardingQuestionOptionDto } from './onboarding-question-option.dto';

export class CreateOnboardingQuestionDto implements ICreateOnboardingQuestionRequest {
  @Expose()
  @ApiProperty({ enum: OnboardingQuestionType, example: OnboardingQuestionType.RADIO })
  @IsEnum(OnboardingQuestionType)
  public readonly type!: OnboardingQuestionType;

  @Expose()
  @ApiProperty({ example: 'How many years of experience do you have?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public readonly question!: string;

  @Expose()
  @ApiPropertyOptional({
    type: [OnboardingQuestionOptionDto],
    description:
      'Required and non-empty (min 2 options) for RADIO/CHECKBOX types. Must be omitted or empty for TEXT.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OnboardingQuestionOptionDto)
  public readonly options?: OnboardingQuestionOptionDto[];

  @Expose({ name: 'is_active' })
  @ApiPropertyOptional({
    name: 'is_active',
    type: Boolean,
    default: true,
    description: 'When true (default), the new question is appended at the end of the active set.',
  })
  @IsOptional()
  @IsBoolean()
  public readonly isActive?: boolean;
}
