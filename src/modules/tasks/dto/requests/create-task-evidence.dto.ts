import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

import { ICreateTaskEvidenceRequest } from './interfaces/create-task-evidence.request.interface';

export class CreateTaskEvidenceDto implements ICreateTaskEvidenceRequest {
  // Rich-text editor JSON document (e.g. TipTap/ProseMirror tree). Stored
  // verbatim as `jsonb` — the server never parses or interprets the structure.
  @Expose({ name: 'remarks' })
  @ApiProperty({
    name: 'remarks',
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Completed.' }],
        },
      ],
    },
  })
  @IsObject()
  @IsNotEmptyObject()
  public readonly remarks!: Record<string, unknown>;

  @Expose({ name: 'file_ids' })
  @ApiPropertyOptional({
    name: 'file_ids',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  public readonly fileIds?: string[];
}
