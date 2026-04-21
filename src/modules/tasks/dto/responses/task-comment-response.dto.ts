import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ITaskCommentResponse } from './interfaces/task-comment.response.interface';

@Exclude()
export class TaskCommentResponseDto implements ITaskCommentResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'task_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly task_id!: string;

  @Expose()
  @ApiProperty({ name: 'author_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly author_id!: string;

  @Expose()
  @ApiProperty({ example: 'I have completed the first subtask.' })
  public readonly body!: string;

  @Expose()
  @ApiProperty({ name: 'is_edited', example: false })
  public readonly is_edited!: boolean;

  @Expose()
  @ApiProperty({ name: 'edited_at', nullable: true })
  public readonly edited_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;
}
