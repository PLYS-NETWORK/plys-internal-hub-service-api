import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectSummary } from './interfaces';

@Exclude()
export class ProjectSummaryDto implements IProjectSummary {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'E-Commerce Platform Redesign' })
  public readonly title!: string;
}
