import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IOnboardingAnswerView,
  IOnboardingDetailResponse,
} from './interfaces/onboarding-detail.response.interface';

@Exclude()
export class OnboardingAnswerViewDto implements IOnboardingAnswerView {
  @Expose()
  @ApiProperty({ name: 'onboarding_question_id' })
  public readonly onboarding_question_id!: string;
  @Expose() @ApiProperty({ name: 'question_order' }) public readonly question_order!: number;
  @Expose() @ApiProperty() public readonly type!: string;
  @Expose() @ApiProperty() public readonly content!: string;
  @Expose()
  @ApiPropertyOptional({ name: 'answer_text', nullable: true })
  public readonly answer_text!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'submitted_at', nullable: true })
  public readonly submitted_at!: string | null;
}

@Exclude()
export class OnboardingDetailResponseDto implements IOnboardingDetailResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'user_id' }) public readonly user_id!: string;
  @Expose() @ApiProperty({ name: 'consultant_email' }) public readonly consultant_email!: string;
  @Expose() @ApiProperty({ name: 'consultant_name' }) public readonly consultant_name!: string;
  @Expose() @ApiPropertyOptional({ nullable: true }) public readonly bio!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'years_of_experience', nullable: true })
  public readonly years_of_experience!: number | null;
  @Expose()
  @ApiPropertyOptional({ name: 'phone_number', nullable: true })
  public readonly phone_number!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'country_code', nullable: true })
  public readonly country_code!: string | null;
  @Expose()
  @ApiPropertyOptional({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
  @Expose() @ApiPropertyOptional({ name: 'cv_url', nullable: true }) public readonly cv_url!:
    | string
    | null;
  @Expose() @ApiProperty() public readonly status!: string;
  @Expose() @ApiPropertyOptional({ nullable: true }) public readonly decision!: string | null;
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
  @ApiPropertyOptional({ name: 'reviewed_by', nullable: true })
  public readonly reviewed_by!: string | null;
  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: string;

  @Expose()
  @ApiProperty({ type: [OnboardingAnswerViewDto] })
  @Type(() => OnboardingAnswerViewDto)
  public readonly answers!: OnboardingAnswerViewDto[];
}
