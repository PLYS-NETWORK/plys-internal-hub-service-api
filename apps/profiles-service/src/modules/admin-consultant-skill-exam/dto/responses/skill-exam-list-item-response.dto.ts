import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import {
  IAdminPaginatedSkillExamsResponse,
  IAdminSkillExamListItemResponse,
  IAdminSkillExamPaginationMeta,
} from './interfaces/skill-exam-list-item.response.interface';

@Exclude()
export class AdminSkillExamListItemResponseDto implements IAdminSkillExamListItemResponse {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'consultant_user_id' })
  public readonly consultant_user_id!: string;
  @Expose()
  @ApiProperty({ name: 'consultant_full_name' })
  public readonly consultant_full_name!: string;

  @Expose() @ApiProperty({ name: 'skill_id' }) public readonly skill_id!: string;
  @Expose() @ApiProperty({ name: 'skill_name' }) public readonly skill_name!: string;

  @Expose() @ApiProperty() public readonly status!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'assigned_proficiency', nullable: true })
  public readonly assigned_proficiency!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'ai_eval_score', nullable: true })
  public readonly ai_eval_score!: string | null;

  @Expose() @ApiProperty({ name: 'attempt_number' }) public readonly attempt_number!: number;

  @Expose()
  @ApiPropertyOptional({ name: 'fail_reason', nullable: true })
  public readonly fail_reason!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'submitted_at', nullable: true })
  public readonly submitted_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ name: 'concluded_at', nullable: true })
  public readonly concluded_at!: string | null;

  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: string;
}

@Exclude()
export class AdminSkillExamPaginationMetaDto implements IAdminSkillExamPaginationMeta {
  @Expose() @ApiProperty() public readonly page!: number;
  @Expose() @ApiProperty() public readonly take!: number;
  @Expose() @ApiProperty({ name: 'item_count' }) public readonly item_count!: number;
  @Expose() @ApiProperty({ name: 'page_count' }) public readonly page_count!: number;
  @Expose()
  @ApiProperty({ name: 'has_previous_page' })
  public readonly has_previous_page!: boolean;
  @Expose() @ApiProperty({ name: 'has_next_page' }) public readonly has_next_page!: boolean;
}

@Exclude()
export class AdminPaginatedSkillExamsResponseDto implements IAdminPaginatedSkillExamsResponse {
  @Expose()
  @ApiProperty({ type: [AdminSkillExamListItemResponseDto] })
  public readonly data!: AdminSkillExamListItemResponseDto[];

  @Expose()
  @ApiProperty({ type: AdminSkillExamPaginationMetaDto })
  public readonly meta!: AdminSkillExamPaginationMetaDto;
}
