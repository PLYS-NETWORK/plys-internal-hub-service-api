import { TimezoneDate } from '@common/decorators/timezone-date.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskAttachmentResponse } from './interfaces/task-attachment.response.interface';

@Exclude()
export class TaskAttachmentResponseDto implements ITaskAttachmentResponse {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'file_id', nullable: true })
  public readonly file_id!: string | null;

  @Expose() @ApiProperty({ name: 'file_name' }) public readonly file_name!: string;

  @Expose()
  @ApiProperty({ name: 'mime_type', nullable: true })
  public readonly mime_type!: string | null;

  @Expose()
  @ApiProperty({ name: 'file_size_bytes', nullable: true })
  public readonly file_size_bytes!: number | null;

  @Expose()
  @TimezoneDate()
  @ApiProperty({ name: 'uploaded_at', example: '2026-05-06 14:30:00' })
  public readonly uploaded_at!: string;
}
