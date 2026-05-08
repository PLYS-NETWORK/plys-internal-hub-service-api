import { ProjectPaymentType } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantProjectDetailResponse } from './interfaces/consultant-project-detail.response.interface';

@Exclude()
export class ConsultantProjectDetailResponseDto implements IConsultantProjectDetailResponse {
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
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ name: 'is_available_to_apply' })
  public readonly is_available_to_apply!: boolean;

  @Expose()
  @ApiProperty({ name: 'match_rate', example: 75 })
  public readonly match_rate!: number;

  @Expose()
  @ApiProperty({ name: 'payment_type', enum: ProjectPaymentType })
  public readonly payment_type!: ProjectPaymentType;
}
