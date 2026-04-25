import { TaskDifficulty } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ITaskItemRequest } from './interfaces/task-item.request.interface';
import { TASK_PRICE_MAX, TASK_TITLE_MAX, TASK_TITLE_MIN } from './project.constants';

export class TaskItemDto implements ITaskItemRequest {
  @Expose()
  @ApiProperty({
    name: 'title',
    example: 'Implement authentication module',
    minLength: TASK_TITLE_MIN,
    maxLength: TASK_TITLE_MAX,
  })
  @IsString()
  @MinLength(TASK_TITLE_MIN)
  @MaxLength(TASK_TITLE_MAX)
  public readonly title!: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'description',
    type: 'object',
    additionalProperties: true,
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
  public readonly description?: Record<string, unknown>;

  @Expose()
  @ApiProperty({ name: 'price', example: 250.0, minimum: 0, maximum: TASK_PRICE_MAX })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(TASK_PRICE_MAX)
  public readonly price!: number;

  @Expose({ name: 'difficulty_level' })
  @ApiPropertyOptional({
    name: 'difficulty_level',
    enum: TaskDifficulty,
    example: TaskDifficulty.MEDIUM,
  })
  @IsEnum(TaskDifficulty)
  @IsOptional()
  public readonly difficultyLevel?: TaskDifficulty;

  @Expose({ name: 'display_order' })
  @ApiPropertyOptional({ name: 'display_order', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly displayOrder?: number;
}
