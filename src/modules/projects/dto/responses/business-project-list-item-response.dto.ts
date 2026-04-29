import { Currency, ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IBusinessProjectListItemResponse } from './interfaces/business-project-list-item.response.interface';

@Exclude()
export class BusinessProjectListItemResponseDto implements IBusinessProjectListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'Build an e-commerce platform' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.DRAFT })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

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
  @ApiProperty({ name: 'total_applications', example: 27 })
  public readonly total_applications!: number;

  @Expose()
  @ApiProperty({ name: 'total_tasks', example: 8 })
  public readonly total_tasks!: number;

  @Expose()
  @ApiProperty({ name: 'total_completed_tasks', example: 3 })
  public readonly total_completed_tasks!: number;

  @Expose()
  @ApiProperty({
    name: 'total_cost',
    example: '12500.00',
    description:
      'Project cost as a fixed-point decimal string. Equals the locked `total_amount` of the PROJECT_PUBLISHED transaction when one exists; otherwise the raw sum of task prices.',
  })
  public readonly total_cost!: string;

  @Expose()
  @ApiProperty({ enum: Currency, example: Currency.USD })
  public readonly currency!: Currency;

  @Expose()
  @ApiProperty({
    name: 'application_avatars',
    type: [String],
    example: ['https://cdn.example.com/u/abc.png', 'https://cdn.example.com/u/def.png'],
    description: 'Distinct applicant avatar URLs (one per consultant who applied).',
  })
  public readonly application_avatars!: string[];
}
