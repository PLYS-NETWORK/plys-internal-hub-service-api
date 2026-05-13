import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import {
  ISkillExamEligibilityDetails,
  ISkillExamEligibilityResponse,
  SkillExamEligibilityBlockReason,
} from './interfaces/skill-exam-eligibility.response.interface';

@Exclude()
export class SkillExamEligibilityDetailsDto implements ISkillExamEligibilityDetails {
  @Expose()
  @ApiPropertyOptional({
    name: 'pending_exam_id',
    description: 'Set when reason = "pending_exam".',
  })
  public readonly pending_exam_id?: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'blocked_until',
    description: 'ISO timestamp the platform block lifts. Set when reason = "platform_block".',
  })
  public readonly blocked_until?: string;

  @Expose()
  @ApiPropertyOptional({
    name: 'exam_expired_count',
    description:
      'Platform-wide expired-attempt counter (0..3). Set when reason = "platform_block".',
  })
  public readonly exam_expired_count?: number;

  @Expose()
  @ApiPropertyOptional({
    name: 'ban_reason',
    description: 'Set when reason = "banned" (e.g. AI_CONTENT_ABUSE).',
  })
  public readonly ban_reason?: string;
}

@Exclude()
export class SkillExamEligibilityResponseDto implements ISkillExamEligibilityResponse {
  @Expose()
  @ApiProperty({ name: 'can_register' })
  public readonly can_register!: boolean;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    description: 'Blocker reason, or null when can_register=true.',
  })
  public readonly reason!: SkillExamEligibilityBlockReason | null;

  @Expose()
  @ApiProperty({ type: SkillExamEligibilityDetailsDto })
  public readonly details!: SkillExamEligibilityDetailsDto;
}
