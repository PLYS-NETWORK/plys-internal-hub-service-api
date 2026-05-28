import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export const ATTACH_FILES_MIN = 1;
export const ATTACH_FILES_MAX = 20;

/**
 * Two-step attachment flow: client uploads files via `/files/upload` first,
 * then submits the returned `file_id`s here. The service:
 *   1. Verifies every `file_id` is owned by the caller.
 *   2. Snapshots the file metadata into `task_attachments`.
 *   3. Marks the source files with `purpose = 'task_attachment'`.
 */
export class AttachFilesDto {
  @Expose({ name: 'file_ids' })
  @ApiProperty({
    name: 'file_ids',
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    minItems: ATTACH_FILES_MIN,
    maxItems: ATTACH_FILES_MAX,
  })
  @IsArray()
  @ArrayMinSize(ATTACH_FILES_MIN)
  @ArrayMaxSize(ATTACH_FILES_MAX)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  public readonly fileIds!: string[];
}
