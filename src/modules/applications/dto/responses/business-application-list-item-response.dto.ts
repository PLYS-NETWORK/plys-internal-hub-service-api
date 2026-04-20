import { ApplicationStatus } from '@database/enums/application-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { ConsultantSummaryDto } from './consultant-summary.dto';
import { IBusinessApplicationListItemResponse } from './interfaces';

@Exclude()
export class BusinessApplicationListItemResponseDto implements IBusinessApplicationListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ type: ConsultantSummaryDto })
  @Type(() => ConsultantSummaryDto)
  public readonly consultant!: ConsultantSummaryDto;

  @Expose()
  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.PENDING })
  public readonly status!: string;

  @Expose()
  @ApiProperty({ name: 'cover_letter', nullable: true })
  public readonly cover_letter!: string | null;

  @Expose()
  @ApiProperty({ name: 'applied_at' })
  public readonly applied_at!: string;

  @Expose()
  @ApiProperty({ name: 'reviewed_at', nullable: true })
  public readonly reviewed_at!: string | null;
}
