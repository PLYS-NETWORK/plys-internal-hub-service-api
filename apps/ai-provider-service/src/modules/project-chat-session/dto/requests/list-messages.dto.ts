import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { IListMessagesRequest } from './interfaces/list-messages.request.interface';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export class ListMessagesQueryDto implements IListMessagesRequest {
  @Expose({ name: 'before' })
  @ApiPropertyOptional({
    name: 'before',
    description:
      'Cursor: returns messages with `seq < before`, newest-first. Omit on the ' +
      "first page; pass the previous page's last `seq` for the next.",
    type: Number,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly before?: number;

  @Expose({ name: 'limit' })
  @ApiPropertyOptional({ name: 'limit', example: DEFAULT_LIMIT, default: DEFAULT_LIMIT })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  public readonly limit: number = DEFAULT_LIMIT;
}
