import { ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectSummaryResponse } from './interfaces/project-summary.response.interface';

@Exclude()
export class ProjectSummaryResponseDto implements IProjectSummaryResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'WEB' })
  public readonly code!: string;

  @Expose()
  @ApiProperty({ example: 'AI-powered customer support automation' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.DRAFT })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ name: 'required_consultants', example: 1 })
  public readonly required_consultants!: number;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({ name: 'updated_at' })
  public readonly updated_at!: Date;
}
