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

import { ICreateBoardResultRequest } from './interfaces/create-board-result.request.interface';

const MAX_ATTACHMENTS = 10;

export class CreateBoardResultDto implements ICreateBoardResultRequest {
  @Expose({ name: 'remarks' })
  @ApiProperty({
    name: 'remarks',
    type: 'object',
    additionalProperties: true,
    description: 'Rich-text JSON document (TipTap/ProseMirror) describing the result.',
  })
  @IsObject()
  @IsNotEmptyObject()
  public readonly remarks!: Record<string, unknown>;

  @Expose({ name: 'file_ids' })
  @ApiPropertyOptional({
    name: 'file_ids',
    type: [String],
    maxItems: MAX_ATTACHMENTS,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @IsUUID('4', { each: true })
  public readonly fileIds?: string[];
}
