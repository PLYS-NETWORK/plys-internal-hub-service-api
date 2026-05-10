import { QuestionType } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

import { ICreateInterviewQuestionRequest } from './create-interview-question.request.interface';

const MANUAL_TYPES: Array<QuestionType.COMMUNICATION | QuestionType.SYSTEM_KNOWLEDGE> = [
  QuestionType.COMMUNICATION,
  QuestionType.SYSTEM_KNOWLEDGE,
];

export class CreateInterviewQuestionDto implements ICreateInterviewQuestionRequest {
  @Expose({ name: 'type' })
  @ApiProperty({
    name: 'type',
    enum: MANUAL_TYPES,
    description: 'Only COMMUNICATION and SYSTEM_KNOWLEDGE may be created by admin',
  })
  @IsIn(MANUAL_TYPES)
  public readonly type!: QuestionType.COMMUNICATION | QuestionType.SYSTEM_KNOWLEDGE;

  @Expose({ name: 'content' })
  @ApiProperty({ name: 'content', example: 'Describe a situation where you had to...' })
  @IsString()
  @IsNotEmpty()
  public readonly content!: string;

  @Expose({ name: 'display_order' })
  @ApiPropertyOptional({ name: 'display_order', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  public readonly displayOrder?: number;
}
