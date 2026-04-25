import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

import { IUpdateTaskEvidenceRequest } from './interfaces/update-task-evidence.request.interface';

export class UpdateTaskEvidenceDto implements IUpdateTaskEvidenceRequest {
  @Expose({ name: 'remarks' })
  @ApiPropertyOptional({
    name: 'remarks',
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated remarks.' }],
        },
      ],
    },
  })
  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  public readonly remarks?: Record<string, unknown>;

  // If provided (even as `[]`), fully replaces the attachment list.
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
