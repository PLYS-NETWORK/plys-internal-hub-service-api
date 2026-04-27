import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { IPendingApplicationsResponse } from './interfaces/pending-applications.response.interface';
import { PendingApplicationItemResponseDto } from './pending-application-item-response.dto';

@Exclude()
export class PendingApplicationsResponseDto implements IPendingApplicationsResponse {
  @Expose()
  @ApiProperty({ name: 'total_pending', example: 17 })
  public readonly total_pending!: number;

  @Expose()
  @ApiProperty({ type: [PendingApplicationItemResponseDto] })
  @Type(() => PendingApplicationItemResponseDto)
  public readonly items!: PendingApplicationItemResponseDto[];

  @Expose()
  @ApiProperty({ example: 1 })
  public readonly page!: number;

  @Expose()
  @ApiProperty({ name: 'page_size', example: 10 })
  public readonly page_size!: number;

  @Expose()
  @ApiProperty({ name: 'total_pages', example: 2 })
  public readonly total_pages!: number;
}
