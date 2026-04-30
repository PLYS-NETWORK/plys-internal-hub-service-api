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

import { ICreateBoardCommentRequest } from './interfaces/create-board-comment.request.interface';

const MAX_ATTACHMENTS = 10;

export class CreateBoardCommentDto implements ICreateBoardCommentRequest {
  @Expose({ name: 'comment' })
  @ApiProperty({
    name: 'comment',
    type: 'object',
    additionalProperties: true,
    description: 'Rich-text JSON document (TipTap/ProseMirror).',
  })
  @IsObject()
  @IsNotEmptyObject()
  public readonly comment!: Record<string, unknown>;

  @Expose({ name: 'file_ids' })
  @ApiPropertyOptional({
    name: 'file_ids',
    type: [String],
    maxItems: MAX_ATTACHMENTS,
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @IsUUID('4', { each: true })
  public readonly fileIds?: string[];
}
