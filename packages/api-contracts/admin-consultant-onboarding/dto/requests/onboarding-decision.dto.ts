import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardingDecision } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { IOnboardingDecisionRequest } from './interfaces/onboarding-decision.request.interface';

export class OnboardingDecisionDto implements IOnboardingDecisionRequest {
  @Expose()
  @ApiProperty({ enum: OnboardingDecision, example: OnboardingDecision.APPROVED })
  @IsEnum(OnboardingDecision)
  public readonly decision!: 'APPROVED' | 'REJECTED';

  @Expose()
  @ApiPropertyOptional({
    name: 'rejection_note',
    example: 'Answers were too shallow — please re-apply with more concrete examples.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public readonly rejection_note?: string;
}
