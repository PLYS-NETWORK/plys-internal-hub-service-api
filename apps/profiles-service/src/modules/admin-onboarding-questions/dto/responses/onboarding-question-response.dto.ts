import { ApiProperty } from '@nestjs/swagger';
import { OnboardingQuestionType } from '@plys/libraries/database/enums';
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
  @ApiProperty({ type: [OnboardingQuestionOptionResponseDto], nullable: true })
  public readonly options!: OnboardingQuestionOptionResponseDto[] | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Order among active questions (1..N). Null when the question is inactive.',
  })
  public readonly position!: number | null;

  @Expose()
  @ApiProperty({ name: 'is_active', example: true })
  public readonly is_active!: boolean;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: string;

  @Expose()
  @ApiProperty({ name: 'updated_at' })
  public readonly updated_at!: string;
}
