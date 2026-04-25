import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { IUpdateProjectRequest } from './interfaces/update-project.request.interface';
import { InterviewQuestionItemDto } from './interview-question-item.dto';
import {
  PROJECT_INTERVIEW_QUESTIONS_MAX,
  PROJECT_REQUIRED_CONSULTANTS_MAX,
  PROJECT_SKILLS_MAX,
  PROJECT_TASKS_MAX,
  PROJECT_TITLE_MAX,
  PROJECT_TITLE_MIN,
} from './project.constants';
import { TaskItemDto } from './task-item.dto';

export class UpdateProjectDto implements IUpdateProjectRequest {
  @Expose()
  @ApiPropertyOptional({
    name: 'title',
    example: 'Build an e-commerce platform',
    minLength: PROJECT_TITLE_MIN,
    maxLength: PROJECT_TITLE_MAX,
  })
  @IsString()
  @MinLength(PROJECT_TITLE_MIN)
  @MaxLength(PROJECT_TITLE_MAX)
  @IsOptional()
  public readonly title?: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'introduction',
    type: 'object',
    additionalProperties: true,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'We need a full-stack team...' }],
        },
      ],
    },
  })
  @IsObject()
  @IsOptional()
  public readonly introduction?: Record<string, unknown>;

  @Expose()
  @ApiPropertyOptional({
    name: 'required_consultants',
    example: 2,
    minimum: 1,
    maximum: PROJECT_REQUIRED_CONSULTANTS_MAX,
  })
  @IsInt()
  @Min(1)
  @Max(PROJECT_REQUIRED_CONSULTANTS_MAX)
  @IsOptional()
  public readonly required_consultants?: number;

  @Expose()
  @ApiPropertyOptional({
    name: 'skills',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: `When provided, replaces the entire set of required skills. Array of unique skill UUIDs. Max ${PROJECT_SKILLS_MAX}.`,
  })
  @IsArray()
  @ArrayMaxSize(PROJECT_SKILLS_MAX)
  @IsUUID('4', { each: true })
  @ArrayUnique()
  @IsOptional()
  public readonly skills?: string[];

  @Expose({ name: 'interview_questions' })
  @ApiPropertyOptional({
    name: 'interview_questions',
    type: [InterviewQuestionItemDto],
    description: `When provided, replaces the entire set of interview questions. Max ${PROJECT_INTERVIEW_QUESTIONS_MAX}.`,
  })
  @IsArray()
  @ArrayMaxSize(PROJECT_INTERVIEW_QUESTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => InterviewQuestionItemDto)
  @IsOptional()
  public readonly interviewQuestions?: InterviewQuestionItemDto[];

  @Expose()
  @ApiPropertyOptional({
    name: 'tasks',
    type: [TaskItemDto],
    description: `When provided, replaces the entire set of tasks. Max ${PROJECT_TASKS_MAX}.`,
  })
  @IsArray()
  @ArrayMaxSize(PROJECT_TASKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => TaskItemDto)
  @IsOptional()
  public readonly tasks?: TaskItemDto[];
}
