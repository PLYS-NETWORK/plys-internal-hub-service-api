import { QuestionType } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IInterviewQuestionResponse } from './interview-question.response.interface';

@Exclude()
export class InterviewQuestionResponseDto implements IInterviewQuestionResponse {
  @Expose()
  @ApiProperty()
  public readonly id!: string;

  @Expose()
  @ApiProperty()
  public readonly application_question_id!: string;

  @Expose()
  @ApiProperty()
  public readonly question_order!: number;

  @Expose()
  @ApiProperty({ enum: QuestionType })
  public readonly type!: QuestionType;

  @Expose()
  @ApiProperty()
  public readonly content!: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly answer_text!: string | null;
}
