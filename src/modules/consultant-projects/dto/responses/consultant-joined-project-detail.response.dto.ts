import { ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { ConsultantExploreSkillResponseDto } from './consultant-explore-skill.response.dto';
import { IConsultantJoinedProjectDetailResponse } from './interfaces/consultant-joined-project-detail.response.interface';

@Exclude()
export class ConsultantJoinedProjectDetailResponseDto implements IConsultantJoinedProjectDetailResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'AI-powered customer support automation' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ example: 'AI-1' })
  public readonly code!: string;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.IN_PROGRESS })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ name: 'started_at', nullable: true, example: '2026-04-20T00:00:00.000Z' })
  public readonly started_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'completed_at', nullable: true, example: null })
  public readonly completed_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'company_name', example: 'Acme Inc.' })
  public readonly company_name!: string;

  @Expose()
  @Type(() => ConsultantExploreSkillResponseDto)
  @ApiProperty({ name: 'required_skills', type: () => [ConsultantExploreSkillResponseDto] })
  public readonly required_skills!: ConsultantExploreSkillResponseDto[];

  @Expose()
  @ApiProperty({ name: 'total_members', example: 4 })
  public readonly total_members!: number;

  @Expose()
  @ApiProperty({ name: 'total_tasks', example: 10 })
  public readonly total_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'completed_tasks_overall', example: 6 })
  public readonly completed_tasks_overall!: number;

  @Expose()
  @ApiProperty({ name: 'completion_pct', example: 60 })
  public readonly completion_pct!: number;

  @Expose()
  @ApiProperty({ name: 'completed_tasks_by_me', example: 3 })
  public readonly completed_tasks_by_me!: number;

  @Expose()
  @ApiProperty({ name: 'in_progress_by_me', example: 1 })
  public readonly in_progress_by_me!: number;
}
