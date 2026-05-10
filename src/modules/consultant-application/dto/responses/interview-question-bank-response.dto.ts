import { QuestionType } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IInterviewQuestionBankResponse } from './interview-question-bank.response.interface';

@Exclude()
export class InterviewQuestionBankResponseDto implements IInterviewQuestionBankResponse {
  @Expose()
  @ApiProperty()
  public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: QuestionType })
  public readonly type!: QuestionType;

  @Expose()
  @ApiProperty()
  public readonly content!: string;

  @Expose()
  @ApiProperty()
  public readonly is_active!: boolean;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly display_order!: number | null;

  @Expose()
  @ApiProperty()
  public readonly created_at!: string;
}
