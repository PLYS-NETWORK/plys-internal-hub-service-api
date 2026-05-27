import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import {
  IOnboardingListItemResponse,
  IPaginatedOnboardingsResponse,
  IPaginationMeta,
} from './interfaces/onboarding-list-item.response.interface';

@Exclude()
export class OnboardingListItemResponseDto implements IOnboardingListItemResponse {
  @Expose()
  @ApiProperty()
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'user_id' })
  public readonly user_id!: string;

  @Expose()
  @ApiProperty({ name: 'consultant_email' })
  public readonly consultant_email!: string;

  @Expose()
  @ApiProperty({ name: 'consultant_name' })
  public readonly consultant_name!: string;

  @Expose()
  @ApiProperty({ example: 'INTERVIEW_SUBMITTED' })
  public readonly status!: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly decision!: string | null;

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

@Exclude()
export class PaginationMetaDto implements IPaginationMeta {
  @Expose() @ApiProperty() public readonly page!: number;
  @Expose() @ApiProperty() public readonly take!: number;
  @Expose() @ApiProperty({ name: 'item_count' }) public readonly item_count!: number;
  @Expose() @ApiProperty({ name: 'page_count' }) public readonly page_count!: number;
  @Expose() @ApiProperty({ name: 'has_previous_page' }) public readonly has_previous_page!: boolean;
  @Expose() @ApiProperty({ name: 'has_next_page' }) public readonly has_next_page!: boolean;
}

@Exclude()
export class PaginatedOnboardingsResponseDto implements IPaginatedOnboardingsResponse {
  @Expose()
  @ApiProperty({ type: [OnboardingListItemResponseDto] })
  public readonly data!: OnboardingListItemResponseDto[];

  @Expose()
  @ApiProperty({ type: PaginationMetaDto })
  public readonly meta!: PaginationMetaDto;
}
