import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { ITaskEvidenceResponse } from './interfaces/task-evidence.response.interface';
import { TaskEvidenceAttachmentResponseDto } from './task-evidence-attachment-response.dto';

@Exclude()
export class TaskEvidenceResponseDto implements ITaskEvidenceResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'task_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly task_id!: string;

  @Expose()
  @ApiProperty({ name: 'author_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly author_id!: string;

  // Round-tripped rich-text JSON document — the server does not parse it.
  @Expose()
  @ApiProperty({
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
  public readonly remarks!: Record<string, unknown>;

  @Expose()
  @ApiProperty({ name: 'is_edited', example: false })
  public readonly is_edited!: boolean;

  @Expose()
  @ApiProperty({ name: 'edited_at', nullable: true })
  public readonly edited_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @Type(() => TaskEvidenceAttachmentResponseDto)
  @ApiProperty({ type: () => [TaskEvidenceAttachmentResponseDto] })
  public readonly attachments!: TaskEvidenceAttachmentResponseDto[];
}
