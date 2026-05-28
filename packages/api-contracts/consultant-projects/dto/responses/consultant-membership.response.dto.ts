import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantMembershipResponse } from './interfaces/consultant-membership.response.interface';

@Exclude()
export class ConsultantMembershipResponseDto implements IConsultantMembershipResponse {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ enum: ProjectMemberStatus, example: ProjectMemberStatus.ACTIVE })
  public readonly status!: ProjectMemberStatus;

  @Expose()
  @ApiProperty({ name: 'joined_at', example: '2026-05-16T10:00:00.000Z' })
  public readonly joined_at!: Date;

  @Expose()
  @ApiProperty({ name: 'left_at', nullable: true, example: null })
  public readonly left_at!: Date | null;
}
