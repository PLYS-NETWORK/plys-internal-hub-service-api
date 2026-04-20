import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectInterviewQuestionResponse } from './interfaces/project-interview-question.response.interface';

@Exclude()
export class ProjectInterviewQuestionResponseDto implements IProjectInterviewQuestionResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'question_text', example: 'Describe your experience with NestJS' })
  public readonly question_text!: string;

  @Expose()
  @ApiProperty({ name: 'display_order', example: 1 })
  public readonly display_order!: number;

  @Expose()
  @ApiProperty({ name: 'is_required', example: true })
  public readonly is_required!: boolean;
}
