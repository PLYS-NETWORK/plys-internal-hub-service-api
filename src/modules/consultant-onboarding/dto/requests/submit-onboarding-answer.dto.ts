import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { ISubmitOnboardingAnswerRequest } from './interfaces/submit-onboarding-answer.request.interface';

export class SubmitOnboardingAnswerDto implements ISubmitOnboardingAnswerRequest {
  @Expose()
  @ApiProperty({
    name: 'onboarding_question_id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  public readonly onboarding_question_id!: string;

  @Expose()
  @ApiProperty({
    name: 'answer_text',
    example: 'I would start by identifying the bounded contexts and...',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  public readonly answer_text!: string;
}
