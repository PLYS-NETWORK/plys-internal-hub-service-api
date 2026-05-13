import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IOnboardingQuestionResponse } from './interfaces/onboarding-question.response.interface';

@Exclude()
export class OnboardingQuestionResponseDto implements IOnboardingQuestionResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'onboarding_question_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly onboarding_question_id!: string;

  @Expose()
  @ApiProperty({ name: 'question_order', example: 1 })
  public readonly question_order!: number;

  @Expose()
  @ApiProperty({ example: 'COMMUNICATION', enum: ['COMMUNICATION', 'SYSTEM_KNOWLEDGE'] })
  public readonly type!: string;

  @Expose()
  @ApiProperty({
    example:
      'Describe a time you had to explain a technical concept to a non-technical stakeholder.',
  })
  public readonly content!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'answer_text', nullable: true })
  public readonly answer_text!: string | null;
}
