import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { ISubmitSkillExamAnswerRequest } from './interfaces/submit-skill-exam-answer.request.interface';

export class SubmitSkillExamAnswerDto implements ISubmitSkillExamAnswerRequest {
  @Expose()
  @ApiProperty({ name: 'exam_question_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  public readonly exam_question_id!: string;

  @Expose()
  @ApiProperty({ name: 'answer_text', example: 'useMemo memoises a computed value...' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  public readonly answer_text!: string;
}
