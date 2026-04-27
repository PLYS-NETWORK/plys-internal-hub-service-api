import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IApplicationsPerProjectItem,
  IApplicationsPerProjectResponse,
} from './interfaces/applications-per-project.response.interface';

@Exclude()
export class ApplicationsPerProjectItemDto implements IApplicationsPerProjectItem {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'project_name', example: 'Project Alpha' })
  public readonly project_name!: string;

  @Expose()
  @ApiProperty({ name: 'total_applications', example: 22 })
  public readonly total_applications!: number;

  @Expose()
  @ApiProperty({ name: 'pending_count', example: 5 })
  public readonly pending_count!: number;

  @Expose()
  @ApiProperty({ name: 'approved_count', example: 10 })
  public readonly approved_count!: number;

  @Expose()
  @ApiProperty({ name: 'rejected_count', example: 7 })
  public readonly rejected_count!: number;
}

@Exclude()
export class ApplicationsPerProjectResponseDto implements IApplicationsPerProjectResponse {
  @Expose()
  @ApiProperty({ type: [ApplicationsPerProjectItemDto] })
  @Type(() => ApplicationsPerProjectItemDto)
  public readonly projects!: ApplicationsPerProjectItemDto[];
}
