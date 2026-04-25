import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IInterviewQuestionItemRequest } from './interfaces/interview-question-item.request.interface';
import { INTERVIEW_QUESTION_MAX, INTERVIEW_QUESTION_MIN } from './project.constants';

export class InterviewQuestionItemDto implements IInterviewQuestionItemRequest {
  @Expose({ name: 'question_text' })
  @ApiProperty({
    name: 'question_text',
    example: 'Describe your experience with NestJS',
    minLength: INTERVIEW_QUESTION_MIN,
    maxLength: INTERVIEW_QUESTION_MAX,
  })
  @IsString()
  @MinLength(INTERVIEW_QUESTION_MIN)
  @MaxLength(INTERVIEW_QUESTION_MAX)
  public readonly questionText!: string;

  @Expose({ name: 'is_required' })
  @ApiPropertyOptional({ name: 'is_required', example: true, default: true })
  @IsBoolean()
  @IsOptional()
  public readonly isRequired?: boolean;
}
