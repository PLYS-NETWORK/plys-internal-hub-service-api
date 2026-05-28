import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IOnboardingStatusResponse } from './interfaces/onboarding-status.response.interface';

@Exclude()
export class OnboardingStatusResponseDto implements IOnboardingStatusResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'IN_INTERVIEW' })
  public readonly status!: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true, example: 'APPROVED' })
  public readonly decision!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'rejection_note', nullable: true })
  public readonly rejection_note!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'blocked_until', nullable: true })
  public readonly blocked_until!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'profile_submitted_at', nullable: true })
  public readonly profile_submitted_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'interview_submitted_at', nullable: true })
  public readonly interview_submitted_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'reviewed_at', nullable: true })
  public readonly reviewed_at!: string | null;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: string;
}
