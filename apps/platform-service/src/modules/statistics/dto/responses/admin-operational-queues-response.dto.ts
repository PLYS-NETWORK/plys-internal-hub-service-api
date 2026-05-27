import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { AdminOperationalQueuesSummaryDto } from './admin-dashboard-summary-response.dto';
import { IAdminOperationalQueuesResponse } from './interfaces/admin-operational-queues.response.interface';

@Exclude()
export class AdminOperationalQueuesResponseDto implements IAdminOperationalQueuesResponse {
  @Expose()
  @Type(() => AdminOperationalQueuesSummaryDto)
  @ApiProperty({ type: AdminOperationalQueuesSummaryDto })
  public readonly counts!: AdminOperationalQueuesSummaryDto;

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
