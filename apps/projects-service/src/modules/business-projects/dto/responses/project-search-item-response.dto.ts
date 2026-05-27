import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IProjectSearchItemResponse } from './interfaces/project-search-item.response.interface';

@Exclude()
export class ProjectSearchItemResponseDto implements IProjectSearchItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'WEB' })
  public readonly code!: string;

  @Expose()
  @ApiProperty({ example: 'AI-powered customer support automation' })
  public readonly title!: string;
}
