import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  ISkillExamDetailResponse,
  ISkillExamQuestionView,
} from './interfaces/skill-exam-detail.response.interface';
import { SkillExamSummaryResponseDto } from './skill-exam-summary-response.dto';

@Exclude()
export class SkillExamQuestionViewDto implements ISkillExamQuestionView {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'exam_question_id' }) public readonly exam_question_id!: string;
  @Expose() @ApiProperty({ name: 'question_order' }) public readonly question_order!: number;
  @Expose() @ApiProperty() public readonly content!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'answer_text', nullable: true })
  public readonly answer_text!: string | null;
}

@Exclude()
export class SkillExamDetailResponseDto
  extends SkillExamSummaryResponseDto
  implements ISkillExamDetailResponse
{
  @Expose()
  @ApiProperty({ type: [SkillExamQuestionViewDto] })
  @Type(() => SkillExamQuestionViewDto)
  public readonly questions!: SkillExamQuestionViewDto[];
}
