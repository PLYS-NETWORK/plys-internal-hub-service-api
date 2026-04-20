import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { IUpdateProjectRequest } from './interfaces/update-project.request.interface';
import { InterviewQuestionItemDto } from './interview-question-item.dto';
import { TaskItemDto } from './task-item.dto';

export class UpdateProjectDto implements IUpdateProjectRequest {
  @Expose()
  @ApiPropertyOptional({ name: 'title', example: 'Build an e-commerce platform', maxLength: 300 })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  public readonly title?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'introduction', example: 'We need a full-stack team...' })
  @IsString()
  @IsOptional()
  public readonly introduction?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'required_consultants', example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly required_consultants?: number;

  @Expose()
  @ApiPropertyOptional({
    name: 'skills',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'When provided, replaces the entire set of required skills. Array of unique skill UUIDs.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  @IsOptional()
  public readonly skills?: string[];

  @Expose({ name: 'interview_questions' })
  @ApiPropertyOptional({
    name: 'interview_questions',
    type: [InterviewQuestionItemDto],
    description: 'When provided, replaces the entire set of interview questions.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewQuestionItemDto)
  @IsOptional()
  public readonly interviewQuestions?: InterviewQuestionItemDto[];

  @Expose()
  @ApiPropertyOptional({
    name: 'tasks',
    type: [TaskItemDto],
    description: 'When provided, replaces the entire set of tasks.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskItemDto)
  @IsOptional()
  public readonly tasks?: TaskItemDto[];
}
