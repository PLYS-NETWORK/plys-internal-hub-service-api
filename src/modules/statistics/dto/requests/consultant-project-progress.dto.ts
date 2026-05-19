import { ProjectStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { IConsultantProjectProgressRequest } from './interfaces/consultant-project-progress.request.interface';

export class ConsultantProjectProgressDto implements IConsultantProjectProgressRequest {
  @Expose({ name: 'status' })
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsEnum(ProjectStatus)
  @IsOptional()
  public readonly status?: ProjectStatus;

  @Expose({ name: 'limit' })
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  public readonly limit: number = 20;
}
