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

import { IUpdateBoardCommentRequest } from './interfaces/update-board-comment.request.interface';

const MAX_ATTACHMENTS = 10;

export class UpdateBoardCommentDto implements IUpdateBoardCommentRequest {
  @Expose({ name: 'comment' })
  @ApiPropertyOptional({
    name: 'comment',
    type: 'object',
    additionalProperties: true,
    description: 'New rich-text body. Setting it flips is_edited to true.',
  })
  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  public readonly comment?: Record<string, unknown>;

  // Replace-semantics: an empty array detaches every file; omitting the field
  // leaves attachments untouched. The undefined-vs-empty distinction matters,
  // so the service must read `dto.fileIds === undefined` directly.
  @Expose({ name: 'file_ids' })
  @ApiPropertyOptional({
    name: 'file_ids',
    type: [String],
    maxItems: MAX_ATTACHMENTS,
    description: 'Full replacement of attachments. Send [] to detach all.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @IsUUID('4', { each: true })
  public readonly fileIds?: string[];
}
