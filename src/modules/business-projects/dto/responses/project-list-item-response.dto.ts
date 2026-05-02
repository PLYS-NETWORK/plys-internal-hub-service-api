import { ProjectPaymentType, ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectListItemResponse } from './interfaces/project-list-item.response.interface';

@Exclude()
export class ProjectListItemResponseDto implements IProjectListItemResponse {
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
  @ApiProperty({ enum: ProjectStatus })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ name: 'payment_type', enum: ProjectPaymentType })
  public readonly payment_type!: ProjectPaymentType;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'required_consultants', example: 1 })
  public readonly required_consultants!: number;

  @Expose()
  @ApiProperty({ name: 'total_tasks', example: 12 })
  public readonly total_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'total_active_members', example: 3 })
  public readonly total_active_members!: number;

  @Expose()
  @ApiProperty({ name: 'total_pending_applications', example: 5 })
  public readonly total_pending_applications!: number;
}
