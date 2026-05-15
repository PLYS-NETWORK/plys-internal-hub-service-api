import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { IOnboardingQuestionOptionInput } from './interfaces/onboarding-question-option.interface';

export class OnboardingQuestionOptionDto implements IOnboardingQuestionOptionInput {
  @Expose()
  @ApiProperty({
    example: 'opt_yes',
    description:
      'Stable identifier — what is stored on every answer. Never edit after a consultant has answered.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  public readonly value!: string;

  @Expose()
  @ApiProperty({
    example: 'Yes, I have',
    description: 'Human-readable option label. Safe to edit; not referenced by answers.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public readonly label!: string;
}
