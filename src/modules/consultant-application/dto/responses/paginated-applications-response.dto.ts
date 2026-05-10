import { ApplicationStatus } from '@database/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

export interface IApplicationListItemResponse {
  readonly id: string;
  readonly consultant_email: string;
  readonly status: ApplicationStatus;
  readonly created_at: string;
  readonly interview_submitted_at: string | null;
  readonly final_score: number | null;
}

export interface IPaginatedApplicationsMeta {
  readonly page: number;
  readonly take: number;
  readonly item_count: number;
  readonly page_count: number;
  readonly has_previous_page: boolean;
  readonly has_next_page: boolean;
}

export interface IPaginatedApplicationsResponse {
  readonly data: IApplicationListItemResponse[];
  readonly meta: IPaginatedApplicationsMeta;
}

@Exclude()
export class ApplicationListItemResponseDto implements IApplicationListItemResponse {
  @Expose()
  @ApiProperty()
  public readonly id!: string;

  @Expose()
  @ApiProperty()
  public readonly consultant_email!: string;

  @Expose()
  @ApiProperty({ enum: ApplicationStatus })
  public readonly status!: ApplicationStatus;

  @Expose()
  @ApiProperty()
  public readonly created_at!: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly interview_submitted_at!: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  public readonly final_score!: number | null;
}
