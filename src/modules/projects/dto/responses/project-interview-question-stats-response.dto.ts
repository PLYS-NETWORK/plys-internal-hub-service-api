import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IInterviewQuestionStatItem,
  IProjectInterviewQuestionStatsResponse,
} from './interfaces/project-interview-question-stats.response.interface';

@Exclude()
export class InterviewQuestionStatItemDto implements IInterviewQuestionStatItem {
  @Expose()
  @ApiProperty({ name: 'question_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly question_id!: string;

  @Expose()
  @ApiProperty({ example: 1 })
  public readonly position!: number;

  @Expose()
  @ApiProperty({ name: 'question_text', example: 'Describe your experience with UX research.' })
  public readonly question_text!: string;

  @Expose()
  @ApiProperty({ name: 'answer_count', example: 22 })
  public readonly answer_count!: number;

  @Expose()
  @ApiProperty({ name: 'skip_count', example: 0 })
  public readonly skip_count!: number;

  @Expose()
  @ApiProperty({ name: 'completion_rate', example: 1.0 })
  public readonly completion_rate!: number;
}

@Exclude()
export class ProjectInterviewQuestionStatsResponseDto implements IProjectInterviewQuestionStatsResponse {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'total_applicants', example: 22 })
  public readonly total_applicants!: number;

  @Expose()
  @ApiProperty({ name: 'total_questions', example: 4 })
  public readonly total_questions!: number;

  @Expose()
  @ApiProperty({ type: [InterviewQuestionStatItemDto] })
  @Type(() => InterviewQuestionStatItemDto)
  public readonly questions!: InterviewQuestionStatItemDto[];

  @Expose()
  @ApiProperty({ name: 'avg_completion_rate', example: 0.887 })
  public readonly avg_completion_rate!: number;
}
