import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { IListNotificationsRequest } from './interfaces/list-notifications.request.interface';

export class ListNotificationsDto implements IListNotificationsRequest {
  @Expose()
  @ApiPropertyOptional({ description: 'Opaque base64 cursor from a previous response.' })
  @IsOptional()
  @IsString()
  public readonly cursor?: string;

  @Expose()
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  public readonly take: number = 20;

  @Expose()
  @ApiPropertyOptional({
    description: 'When true, restrict results to unread notifications only.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  public readonly unread?: boolean;
}
