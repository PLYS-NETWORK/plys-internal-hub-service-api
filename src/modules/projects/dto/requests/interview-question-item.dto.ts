import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

import { IInterviewQuestionItemRequest } from './interfaces/interview-question-item.request.interface';

export class InterviewQuestionItemDto implements IInterviewQuestionItemRequest {
  @Expose({ name: 'question_text' })
  @ApiProperty({
    name: 'question_text',
    example: 'Describe your experience with NestJS',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  public readonly questionText!: string;

  @Expose({ name: 'is_required' })
  @ApiPropertyOptional({ name: 'is_required', example: true, default: true })
  @IsBoolean()
  @IsOptional()
  public readonly isRequired?: boolean;
}
