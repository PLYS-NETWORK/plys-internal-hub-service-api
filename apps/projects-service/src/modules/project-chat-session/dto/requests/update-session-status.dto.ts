import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatSessionStatus } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';

import { IUpdateSessionStatusRequest } from './interfaces/update-session-status.request.interface';

// `active` deliberately excluded — the FE cannot reopen a closed session.
const ALLOWED_TARGET_STATUSES: ChatSessionStatus[] = [
  ChatSessionStatus.COMPLETED,
  ChatSessionStatus.ABANDONED,
];

export class UpdateSessionStatusDto implements IUpdateSessionStatusRequest {
  @Expose({ name: 'status' })
  @ApiProperty({
    name: 'status',
    enum: ALLOWED_TARGET_STATUSES,
    example: ChatSessionStatus.COMPLETED,
  })
  @IsIn(ALLOWED_TARGET_STATUSES)
  public readonly status!: ChatSessionStatus;

  @Expose({ name: 'created_task_ids' })
  @ApiPropertyOptional({
    name: 'created_task_ids',
    type: [String],
    description:
      'Optional. Task IDs the FE just created from this session — stored on ' +
      'the row for forensic / audit purposes only.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  public readonly createdTaskIds?: string[];
}
