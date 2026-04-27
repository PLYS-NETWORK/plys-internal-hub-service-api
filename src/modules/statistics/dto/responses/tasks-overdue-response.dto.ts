import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  ITasksOverdueByProject,
  ITasksOverdueResponse,
} from './interfaces/tasks-overdue.response.interface';

@Exclude()
export class TasksOverdueByProjectDto implements ITasksOverdueByProject {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'project_name', example: 'Project Alpha' })
  public readonly project_name!: string;

  @Expose()
  @ApiProperty({ name: 'overdue_count', example: 12 })
  public readonly overdue_count!: number;
}

@Exclude()
export class TasksOverdueResponseDto implements ITasksOverdueResponse {
  @Expose()
  @ApiProperty({ name: 'overdue_count', example: 32 })
  public readonly overdue_count!: number;

  @Expose()
  @ApiProperty({ name: 'by_project', type: [TasksOverdueByProjectDto] })
  @Type(() => TasksOverdueByProjectDto)
  public readonly by_project!: TasksOverdueByProjectDto[];
}
