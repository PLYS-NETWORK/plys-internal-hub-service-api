import { ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { IBusinessProjectListItemResponse } from './interfaces/business-project-list-item.response.interface';
import { ProjectInterviewQuestionResponseDto } from './project-interview-question-response.dto';
import { ProjectSkillResponseDto } from './project-skill-response.dto';

@Exclude()
export class BusinessProjectListItemResponseDto implements IBusinessProjectListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'business_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly business_id!: string;

  @Expose()
  @ApiProperty({ example: 'Build an e-commerce platform' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
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
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.DRAFT })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ name: 'required_consultants', example: 2 })
  public readonly required_consultants!: number;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'started_at', nullable: true })
  public readonly started_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'completed_at', nullable: true })
  public readonly completed_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'cancelled_at', nullable: true })
  public readonly cancelled_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({ type: [ProjectSkillResponseDto] })
  @Type(() => ProjectSkillResponseDto)
  public readonly skills!: ProjectSkillResponseDto[];

  @Expose()
  @ApiProperty({ name: 'interview_questions', type: [ProjectInterviewQuestionResponseDto] })
  @Type(() => ProjectInterviewQuestionResponseDto)
  public readonly interview_questions!: ProjectInterviewQuestionResponseDto[];

  @Expose()
  @ApiProperty({ name: 'total_tasks', example: 8 })
  public readonly total_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'total_completed_tasks', example: 3 })
  public readonly total_completed_tasks!: number;

  @Expose()
  @ApiProperty({
    name: 'total_costs',
    example: '12500.00',
    description:
      'Project cost incl. platform commission, returned as a fixed-point decimal string. Formula: sum(task.price) × (1 + business.commission_rate); commission is 0 for credit-billed businesses.',
  })
  public readonly total_costs!: string;

  @Expose()
  @ApiProperty({ name: 'total_members', example: 4 })
  public readonly total_members!: number;

  @Expose()
  @ApiProperty({ name: 'total_applications', example: 27 })
  public readonly total_applications!: number;
}
