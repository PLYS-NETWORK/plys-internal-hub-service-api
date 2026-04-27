import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { IProjectMembersOverviewResponse } from './interfaces/project-members-overview.response.interface';
import { ProjectMemberOverviewResponseDto } from './project-member-overview-response.dto';

@Exclude()
export class ProjectMembersOverviewResponseDto implements IProjectMembersOverviewResponse {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'total_members', example: 8 })
  public readonly total_members!: number;

  @Expose()
  @ApiProperty({ name: 'pending_approval_count', example: 2 })
  public readonly pending_approval_count!: number;

  @Expose()
  @ApiProperty({ type: [ProjectMemberOverviewResponseDto] })
  @Type(() => ProjectMemberOverviewResponseDto)
  public readonly members!: ProjectMemberOverviewResponseDto[];
}
