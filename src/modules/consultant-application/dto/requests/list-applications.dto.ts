import { ApplicationStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { IListApplicationsRequest } from './list-applications.request.interface';

export class ListApplicationsDto implements IListApplicationsRequest {
  @Expose({ name: 'status' })
  @ApiPropertyOptional({ name: 'status', enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  public readonly status?: ApplicationStatus;

  @Expose({ name: 'keyword' })
  @ApiPropertyOptional({ name: 'keyword', example: 'john' })
  @IsOptional()
  @IsString()
  public readonly keyword?: string;

  @Expose({ name: 'page' })
  @ApiPropertyOptional({ name: 'page', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page: number = 1;

  @Expose({ name: 'take' })
  @ApiPropertyOptional({ name: 'take', default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly take: number = 20;
}
