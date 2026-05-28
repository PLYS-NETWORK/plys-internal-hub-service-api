import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantWorkspaceListItemResponse } from './interfaces/consultant-workspace-list-item.response.interface';

@Exclude()
export class ConsultantWorkspaceListItemResponseDto implements IConsultantWorkspaceListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'AI-powered customer support automation' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ example: 'AI-1' })
  public readonly code!: string;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.IN_PROGRESS })
  public readonly status!: ProjectStatus;
}
