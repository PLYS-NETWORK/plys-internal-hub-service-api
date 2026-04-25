import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsObject } from 'class-validator';

import { ICreateTaskCommentRequest } from './interfaces/create-task-comment.request.interface';

export class CreateTaskCommentDto implements ICreateTaskCommentRequest {
  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'I have completed the first subtask.' }],
        },
      ],
    },
  })
  @IsObject()
  public readonly comment!: Record<string, unknown>;
}
