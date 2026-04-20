import { TaskDifficulty } from '@database/enums/task-difficulty.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { ITaskItemRequest } from './interfaces/task-item.request.interface';

export class TaskItemDto implements ITaskItemRequest {
  @Expose()
  @ApiProperty({ name: 'title', example: 'Implement authentication module', maxLength: 300 })
  @IsString()
  @MaxLength(300)
  public readonly title!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'description', example: 'Build JWT-based auth with refresh tokens' })
  @IsString()
  @IsOptional()
  public readonly description?: string;

  @Expose()
  @ApiProperty({ name: 'price', example: 250.0, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
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
