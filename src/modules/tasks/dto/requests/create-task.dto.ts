import { TaskDifficulty } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

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
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    required: false,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Build JWT-based auth with refresh tokens.' }],
        },
      ],
    },
  })
  @IsObject()
  @IsOptional()
  public readonly description?: Record<string, unknown> | null;

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
