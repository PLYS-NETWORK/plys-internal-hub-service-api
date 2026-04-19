import { PROJECT_STATUSES, ProjectStatus } from '@database/enums/project-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { IUpdateProjectStatusRequest } from './interfaces/update-project-status.request.interface';

export class UpdateProjectStatusDto implements IUpdateProjectStatusRequest {
  @Expose()
  @ApiProperty({ name: 'status', enum: ProjectStatus, example: ProjectStatus.SETTING_UP })
  @IsEnum(ProjectStatus, { message: `status must be one of: ${PROJECT_STATUSES.join(', ')}` })
  public readonly status!: ProjectStatus;
}
