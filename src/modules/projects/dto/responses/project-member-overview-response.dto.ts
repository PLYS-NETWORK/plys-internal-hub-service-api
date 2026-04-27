import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import {
  IProjectMemberOverviewResponse,
  MemberActivityStatus,
} from './interfaces/project-member-overview.response.interface';

@Exclude()
export class ProjectMemberOverviewResponseDto implements IProjectMemberOverviewResponse {
  @Expose()
  @ApiProperty({ name: 'user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly user_id!: string;

  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Nguyen Van A' })
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({ name: 'avatar_initials', example: 'NA' })
  public readonly avatar_initials!: string;

  @Expose()
  @ApiProperty({ name: 'joined_at', example: '2026-01-16T10:00:00Z' })
  public readonly joined_at!: Date;

  @Expose()
  @ApiProperty({ name: 'last_active_at', nullable: true, example: '2026-04-27T06:45:00Z' })
  public readonly last_active_at!: Date | null;

  @Expose()
  @ApiProperty({
    name: 'activity_status',
    enum: ['active', 'idle', 'offline'],
    example: 'active',
  })
  public readonly activity_status!: MemberActivityStatus;
}
