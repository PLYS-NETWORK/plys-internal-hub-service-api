import { ProjectPaymentType } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantExploreProjectListItemResponse } from './interfaces/consultant-explore-project-list-item.response.interface';

@Exclude()
export class ConsultantExploreProjectListItemResponseDto implements IConsultantExploreProjectListItemResponse {
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
}
