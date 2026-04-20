import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { IReviewApplicationRequest } from './interfaces';

export class ReviewApplicationDto implements IReviewApplicationRequest {
  @Expose()
  @ApiProperty({
    enum: ['approve', 'reject'],
    example: 'approve',
    description: 'Action to take on the application.',
  })
  @IsString()
  @IsIn(['approve', 'reject'])
  public readonly action!: 'approve' | 'reject';

  @Expose({ name: 'rejection_reason' })
  @ApiPropertyOptional({
    name: 'rejection_reason',
    example: 'We are looking for someone with more experience in this area.',
    description: 'Reason for rejection (optional, only used when action is "reject").',
  })
  @IsString()
  @IsOptional()
  public readonly rejectionReason?: string;
}
