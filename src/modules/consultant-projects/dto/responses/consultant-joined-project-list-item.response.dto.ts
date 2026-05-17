import { ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantJoinedProjectListItemResponse } from './interfaces/consultant-joined-project-list-item.response.interface';

@Exclude()
export class ConsultantJoinedProjectListItemResponseDto implements IConsultantJoinedProjectListItemResponse {
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
  @ApiProperty({ name: 'started_at', nullable: true, example: '2026-04-20T00:00:00.000Z' })
  public readonly started_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'company_name', example: 'Acme Inc.' })
  public readonly company_name!: string;

  @Expose()
  @ApiProperty({ name: 'completion_pct', example: 60 })
  public readonly completion_pct!: number;

  @Expose()
  @ApiProperty({ name: 'completed_tasks_by_me', example: 3 })
  public readonly completed_tasks_by_me!: number;
}
