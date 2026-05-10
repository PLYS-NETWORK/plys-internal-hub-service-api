import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { ISubmitAnswerRequest } from './submit-answer.request.interface';

export class SubmitAnswerDto implements ISubmitAnswerRequest {
  @Expose({ name: 'application_question_id' })
  @ApiProperty({ name: 'application_question_id', example: 'uuid-here' })
  @IsUUID('4')
  public readonly applicationQuestionId!: string;

  @Expose({ name: 'answer_text' })
  @ApiProperty({ name: 'answer_text', example: 'My answer is...' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  public readonly answerText!: string;
}
