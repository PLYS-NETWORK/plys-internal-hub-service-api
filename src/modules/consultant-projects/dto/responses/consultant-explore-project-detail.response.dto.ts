import { ProjectPaymentType, ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { ConsultantExploreSkillResponseDto } from './consultant-explore-skill.response.dto';
import { IConsultantExploreProjectDetailResponse } from './interfaces/consultant-explore-project-detail.response.interface';

@Exclude()
export class ConsultantExploreProjectDetailResponseDto implements IConsultantExploreProjectDetailResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'AI-powered customer support automation' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ name: 'company_name', example: 'Acme Inc.' })
  public readonly company_name!: string;

  @Expose()
  @ApiProperty({ name: 'is_platform_partner', example: false })
  public readonly is_platform_partner!: boolean;

  @Expose()
  @ApiProperty({ name: 'is_joined', example: false })
  public readonly is_joined!: boolean;

  @Expose()
  @ApiProperty({ name: 'is_available_to_apply', example: true })
  public readonly is_available_to_apply!: boolean;

  @Expose()
  @ApiProperty({ name: 'match_rate', example: 75 })
  public readonly match_rate!: number;

  @Expose()
  @ApiProperty({ name: 'avg_price_per_task', nullable: true, example: 80.0 })
  public readonly avg_price_per_task!: number | null;

  @Expose()
  @ApiProperty({ name: 'payment_type', enum: ProjectPaymentType })
  public readonly payment_type!: ProjectPaymentType;

  @Expose()
  @ApiProperty({ name: 'total_members', example: 2 })
  public readonly total_members!: number;

  @Expose()
  @ApiProperty({ name: 'required_consultants', example: 5 })
  public readonly required_consultants!: number;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true, example: '2026-04-18T00:00:00.000Z' })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'started_at', nullable: true, example: '2026-04-20T00:00:00.000Z' })
  public readonly started_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'completed_at', nullable: true, example: null })
  public readonly completed_at!: Date | null;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.PUBLISHED })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @Type(() => ConsultantExploreSkillResponseDto)
  @ApiProperty({ name: 'required_skills', type: () => [ConsultantExploreSkillResponseDto] })
  public readonly required_skills!: ConsultantExploreSkillResponseDto[];
}
