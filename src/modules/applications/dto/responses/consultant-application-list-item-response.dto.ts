import { ApplicationStatus } from '@database/enums/application-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { IConsultantApplicationListItemResponse } from './interfaces';
import { ProjectSummaryDto } from './project-summary.dto';

@Exclude()
export class ConsultantApplicationListItemResponseDto implements IConsultantApplicationListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ type: ProjectSummaryDto })
  @Type(() => ProjectSummaryDto)
  public readonly project!: ProjectSummaryDto;

  @Expose()
  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.PENDING })
  public readonly status!: string;

  @Expose()
  @ApiProperty({ name: 'cover_letter', nullable: true })
  public readonly cover_letter!: string | null;

  @Expose()
  @ApiProperty({ name: 'applied_at' })
  public readonly applied_at!: string;
}
