import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ISkillExamSummaryResponse } from './interfaces/skill-exam-summary.response.interface';

@Exclude()
export class SkillExamSummaryResponseDto implements ISkillExamSummaryResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'skill_id' }) public readonly skill_id!: string;
  @Expose() @ApiProperty({ name: 'skill_name' }) public readonly skill_name!: string;

  // Raw internal status (GENERATING_QUESTIONS / IN_PROGRESS / SUBMITTED /
  // RUNNING_COPYLEAKS / RUNNING_AI_EVAL / EXPIRED / COPYLEAKS_FAILED / FAILED / PASSED).
  @Expose() @ApiProperty() public readonly status!: string;

  // Consultant-facing logical status — collapses SUBMITTED/RUNNING_COPYLEAKS/RUNNING_AI_EVAL
  // into a single PENDING_REVIEW value so the Lonaos UI can render a steady waiting state.
  @Expose()
  @ApiProperty({ name: 'consultant_view_status' })
  public readonly consultant_view_status!: string;

  @Expose() @ApiProperty({ name: 'attempt_number' }) public readonly attempt_number!: number;
  @Expose()
  @ApiPropertyOptional({ name: 'ai_eval_score', nullable: true })
  public readonly ai_eval_score!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'correct_count', nullable: true })
  public readonly correct_count!: number | null;
  @Expose()
  @ApiPropertyOptional({ name: 'assigned_proficiency', nullable: true })
  public readonly assigned_proficiency!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'cooldown_until', nullable: true })
  public readonly cooldown_until!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'fail_reason', nullable: true })
  public readonly fail_reason!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'started_at', nullable: true })
  public readonly started_at!: string | null;

  // 60-minute deadline (only while IN_PROGRESS; null otherwise). Rendered in
  // the consultant's timezone as ISO with offset.
  @Expose()
  @ApiPropertyOptional({ name: 'expires_at', nullable: true })
  public readonly expires_at!: string | null;

  // Seconds left until expires_at; null when not IN_PROGRESS.
  @Expose()
  @ApiPropertyOptional({ name: 'remaining_seconds', nullable: true })
  public readonly remaining_seconds!: number | null;

  @Expose()
  @ApiPropertyOptional({ name: 'submitted_at', nullable: true })
  public readonly submitted_at!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'concluded_at', nullable: true })
  public readonly concluded_at!: string | null;
  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: string;
}
