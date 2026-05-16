import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { AdminUsersStatusCountsDto } from './admin-dashboard-summary-response.dto';
import { IAdminUsersBreakdownResponse } from './interfaces/admin-users-breakdown.response.interface';

@Exclude()
export class AdminUsersBreakdownResponseDto implements IAdminUsersBreakdownResponse {
  @Expose()
  @Type(() => AdminUsersStatusCountsDto)
  @ApiProperty({ type: AdminUsersStatusCountsDto })
  public readonly business!: AdminUsersStatusCountsDto;

  @Expose()
  @Type(() => AdminUsersStatusCountsDto)
  @ApiProperty({ type: AdminUsersStatusCountsDto })
  public readonly consultant!: AdminUsersStatusCountsDto;
}
