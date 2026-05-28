import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { IUpdateOnboardingQuestionRequest } from './interfaces/update-onboarding-question.request.interface';
import { OnboardingQuestionOptionDto } from './onboarding-question-option.dto';

// Type changes are forbidden — admin must soft-delete + recreate if the question
// type is wrong, since type-change would invalidate existing answer snapshots.
export class UpdateOnboardingQuestionDto implements IUpdateOnboardingQuestionRequest {
  @Expose()
  @ApiPropertyOptional({ example: 'Updated question text' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public readonly question?: string;

  @Expose()
  @ApiPropertyOptional({
    type: [OnboardingQuestionOptionDto],
    description: 'Replace options entirely. Service rejects changing options for TEXT questions.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OnboardingQuestionOptionDto)
  public readonly options?: OnboardingQuestionOptionDto[];
}
