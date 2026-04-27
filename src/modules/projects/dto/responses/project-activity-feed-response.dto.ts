import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { IProjectActivityFeedResponse } from './interfaces/project-activity-feed.response.interface';
import { ProjectActivityEventResponseDto } from './project-activity-event-response.dto';

@Exclude()
export class ProjectActivityFeedResponseDto implements IProjectActivityFeedResponse {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ type: [ProjectActivityEventResponseDto] })
  @Type(() => ProjectActivityEventResponseDto)
  public readonly events!: ProjectActivityEventResponseDto[];

  @Expose()
  @ApiProperty({ example: 1 })
  public readonly page!: number;

  @Expose()
  @ApiProperty({ name: 'page_size', example: 20 })
  public readonly page_size!: number;

  @Expose()
  @ApiProperty({ name: 'total_events', example: 47 })
  public readonly total_events!: number;

  @Expose()
  @ApiProperty({ name: 'total_pages', example: 3 })
  public readonly total_pages!: number;
}
