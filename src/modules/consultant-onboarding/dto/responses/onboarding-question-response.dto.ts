import { OnboardingQuestionType } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import {
  IOnboardingQuestionOptionResponse,
  IOnboardingQuestionResponse,
} from './interfaces/onboarding-question.response.interface';

@Exclude()
export class OnboardingQuestionOptionResponseDto implements IOnboardingQuestionOptionResponse {
  @Expose()
  @ApiProperty({ example: 'opt_yes' })
  public readonly value!: string;

  @Expose()
  @ApiProperty({ example: 'Yes, I have' })
  public readonly label!: string;
}

@Exclude()
export class OnboardingQuestionResponseDto implements IOnboardingQuestionResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: OnboardingQuestionType })
  public readonly type!: OnboardingQuestionType;

  @Expose()
  @ApiProperty({ example: 'How many years of experience do you have?' })
  public readonly question!: string;

  @Expose()
  @ApiPropertyOptional({ type: [OnboardingQuestionOptionResponseDto], nullable: true })
  public readonly options!: OnboardingQuestionOptionResponseDto[] | null;

  @Expose()
  @ApiProperty({ example: 1, description: 'Order within the active question set (1..N).' })
  public readonly position!: number;
}
