import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskEvidenceAttachmentResponse } from './interfaces/task-evidence-attachment.response.interface';

@Exclude()
export class TaskEvidenceAttachmentResponseDto implements ITaskEvidenceAttachmentResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'file_id', nullable: true, example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly file_id!: string | null;

  @Expose()
  @ApiProperty({ name: 'file_name', example: 'evidence.pdf' })
  public readonly file_name!: string;

  @Expose()
  @ApiProperty({ name: 'file_url', example: 'https://files.example.com/2026/04/...' })
  public readonly file_url!: string;

  @Expose()
  @ApiProperty({ name: 'mime_type', nullable: true, example: 'application/pdf' })
  public readonly mime_type!: string | null;

  @Expose()
  @ApiProperty({ name: 'file_size_bytes', nullable: true, example: 12345 })
  public readonly file_size_bytes!: number | null;

  @Expose()
  @ApiProperty({ name: 'uploaded_at' })
  public readonly uploaded_at!: Date;
}
