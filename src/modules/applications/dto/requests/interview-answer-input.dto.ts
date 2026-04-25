import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsObject, IsUUID } from 'class-validator';

import { IInterviewAnswerInput } from './interfaces';

export class InterviewAnswerInputDto implements IInterviewAnswerInput {
  @Expose({ name: 'question_id' })
  @ApiProperty({
    name: 'question_id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  public readonly questionId!: string;

  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'I have 5 years of experience in this field...' }],
        },
      ],
    },
  })
  @IsObject()
  public readonly answer!: Record<string, unknown>;
}
