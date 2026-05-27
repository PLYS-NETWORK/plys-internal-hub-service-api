import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsObject, IsUUID, ValidateNested } from 'class-validator';

import {
  ISubmitOnboardingAnswerItem,
  ISubmitOnboardingAnswersRequest,
  ISubmitOnboardingAnswerValueRequest,
} from './interfaces/submit-onboarding-answers.request.interface';

/**
 * Shape of `answer_value` jsonb depends on the question type:
 *   TEXT     -> { text: string }
 *   RADIO    -> { value: string }   // matches one of question's option values
 *   CHECKBOX -> { values: string[] } // non-empty subset of option values
 *
 * Shape-vs-type validation runs in the service, not class-validator — the wire
 * shape is best expressed as a single jsonb object whose contents the service
 * verifies against the question type and its options.
 */
export class SubmitOnboardingAnswerItemDto implements ISubmitOnboardingAnswerItem {
  @Expose({ name: 'onboarding_question_id' })
  @ApiProperty({
    name: 'onboarding_question_id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  public readonly onboardingQuestionId!: string;

  @Expose({ name: 'answer_value' })
  @ApiProperty({
    name: 'answer_value',
    type: 'object',
    description:
      'TEXT: { text: string } — RADIO: { value: string } — CHECKBOX: { values: string[] }.',
  })
  @IsObject()
  public readonly answerValue!: ISubmitOnboardingAnswerValueRequest;
}

export class SubmitOnboardingAnswersDto implements ISubmitOnboardingAnswersRequest {
  @Expose()
  @ApiProperty({
    type: [SubmitOnboardingAnswerItemDto],
    description:
      'Every active onboarding question must appear exactly once. Coverage and per-item shape are validated server-side.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitOnboardingAnswerItemDto)
  public readonly answers!: SubmitOnboardingAnswerItemDto[];
}
