import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsObject } from 'class-validator';

import { IUpdateTaskCommentRequest } from './interfaces/update-task-comment.request.interface';

export class UpdateTaskCommentDto implements IUpdateTaskCommentRequest {
  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated comment text.' }],
        },
      ],
    },
  })
  @IsObject()
  public readonly comment!: Record<string, unknown>;
}
