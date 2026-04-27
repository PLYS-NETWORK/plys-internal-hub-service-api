import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  ITasksCompletionItem,
  ITasksCompletionResponse,
} from './interfaces/tasks-completion.response.interface';

@Exclude()
export class TasksCompletionItemDto implements ITasksCompletionItem {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'project_name', example: 'Project Alpha' })
  public readonly project_name!: string;

  @Expose()
  @ApiProperty({ name: 'total_tasks', example: 50 })
  public readonly total_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'completed_tasks', example: 36 })
  public readonly completed_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'completion_rate', example: 0.72 })
  public readonly completion_rate!: number;
}

@Exclude()
export class TasksCompletionResponseDto implements ITasksCompletionResponse {
  @Expose()
  @ApiProperty({ type: [TasksCompletionItemDto] })
  @Type(() => TasksCompletionItemDto)
  public readonly projects!: TasksCompletionItemDto[];
}
