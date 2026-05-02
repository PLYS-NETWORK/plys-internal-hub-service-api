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

import { IUpdateBoardEvidenceRequest } from './interfaces/update-board-evidence.request.interface';

const MAX_ATTACHMENTS = 10;

export class UpdateBoardEvidenceDto implements IUpdateBoardEvidenceRequest {
  @Expose({ name: 'remarks' })
  @ApiPropertyOptional({
    name: 'remarks',
    type: 'object',
    additionalProperties: true,
    description: 'New rich-text body. Setting it flips is_edited to true.',
  })
  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  public readonly remarks?: Record<string, unknown>;

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
