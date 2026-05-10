import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { IAdminDecideRequest } from './admin-decide.request.interface';

export class AdminDecideDto implements IAdminDecideRequest {
  @Expose({ name: 'decision' })
  @ApiProperty({ name: 'decision', enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  public readonly decision!: 'APPROVED' | 'REJECTED';

  @Expose({ name: 'rejection_reason' })
  @ApiPropertyOptional({
    name: 'rejection_reason',
    example: 'Score did not meet the minimum threshold.',
  })
  @IsOptional()
  @IsString()
  public readonly rejectionReason?: string;
}
