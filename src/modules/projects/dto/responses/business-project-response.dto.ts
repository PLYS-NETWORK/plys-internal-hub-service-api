import { ProjectStatus } from '@database/enums/project-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { IBusinessProjectResponse } from './interfaces/business-project.response.interface';
import { ProjectInterviewQuestionResponseDto } from './project-interview-question-response.dto';
import { ProjectSkillResponseDto } from './project-skill-response.dto';

@Exclude()
export class BusinessProjectResponseDto implements IBusinessProjectResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose({ name: 'businessId' })
  @ApiProperty({ name: 'business_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly business_id!: string;

  @Expose()
  @ApiProperty({ example: 'Build an e-commerce platform' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly introduction!: string | null;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.DRAFT })
  public readonly status!: ProjectStatus;

  @Expose({ name: 'requiredConsultants' })
  @ApiProperty({ name: 'required_consultants', example: 2 })
  public readonly required_consultants!: number;

  @Expose({ name: 'publishedAt' })
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

  @Expose({ name: 'startedAt' })
  @ApiProperty({ name: 'started_at', nullable: true })
  public readonly started_at!: Date | null;

  @Expose({ name: 'completedAt' })
  @ApiProperty({ name: 'completed_at', nullable: true })
  public readonly completed_at!: Date | null;

  @Expose({ name: 'cancelledAt' })
  @ApiProperty({ name: 'cancelled_at', nullable: true })
  public readonly cancelled_at!: Date | null;

  @Expose({ name: 'createdAt' })
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
}
