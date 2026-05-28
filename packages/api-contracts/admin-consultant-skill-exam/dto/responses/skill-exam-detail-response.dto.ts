import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IAdminSkillExamDetailResponse,
  IAdminSkillExamQuestionView,
} from './interfaces/skill-exam-detail.response.interface';
import { AdminSkillExamListItemResponseDto } from './skill-exam-list-item-response.dto';

@Exclude()
export class AdminSkillExamQuestionViewDto implements IAdminSkillExamQuestionView {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'question_order' }) public readonly question_order!: number;
  @Expose() @ApiProperty() public readonly content!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'answer_text', nullable: true })
  public readonly answer_text!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'ai_eval_score', nullable: true })
  public readonly ai_eval_score!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'copyleaks_ai_score', nullable: true })
  public readonly copyleaks_ai_score!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'is_correct', nullable: true })
  public readonly is_correct!: boolean | null;
  @Expose()
  @ApiPropertyOptional({ name: 'ai_feedback', nullable: true })
  public readonly ai_feedback!: string | null;
}

@Exclude()
export class AdminSkillExamDetailResponseDto
  extends AdminSkillExamListItemResponseDto
  implements IAdminSkillExamDetailResponse
{
  @Expose() @ApiPropertyOptional({ nullable: true }) public readonly bio!: string | null;
  @Expose() @ApiProperty({ name: 'consultant_email' }) public readonly consultant_email!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'started_at', nullable: true })
  public readonly started_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'expires_at', nullable: true })
  public readonly expires_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'copyleaks_aggregate_score', nullable: true })
  public readonly copyleaks_aggregate_score!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'cooldown_until', nullable: true })
  public readonly cooldown_until!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'correct_count', nullable: true })
  public readonly correct_count!: number | null;

  @Expose()
  @ApiProperty({ type: [AdminSkillExamQuestionViewDto] })
  @Type(() => AdminSkillExamQuestionViewDto)
  public readonly questions!: AdminSkillExamQuestionViewDto[];
}
