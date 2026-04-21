import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { ICreateTaskRequest } from './interfaces/create-task.request.interface';

export class CreateTaskDto implements ICreateTaskRequest {
  @Expose({ name: 'project_id' })
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  public readonly projectId!: string;

  @Expose()
  @ApiProperty({ example: 'Implement authentication module' })
  @IsString()
  @IsNotEmpty()
  public readonly title!: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  @IsString()
  @IsOptional()
  public readonly description?: string | null;

  @Expose()
  @ApiProperty({ example: 250.0 })
  @IsNumber()
  @Min(0)
  public readonly price!: number;

  @Expose({ name: 'difficulty_level' })
  @ApiProperty({
    name: 'difficulty_level',
    enum: TaskDifficulty,
    example: TaskDifficulty.MEDIUM,
    required: false,
  })
  @IsEnum(TaskDifficulty)
  @IsOptional()
  public readonly difficultyLevel?: TaskDifficulty;
}
