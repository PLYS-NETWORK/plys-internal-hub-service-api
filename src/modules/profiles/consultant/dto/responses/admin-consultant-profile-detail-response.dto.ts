import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

import { ConsultantProfileResponseDto } from './consultant-profile-response.dto';
import { IAdminConsultantProfileDetailResponse } from './interfaces/admin-consultant-profile-detail.response.interface';

/**
 * Admin-only detail view. Extends the user-scoped DTO with admin-relevant
 * columns (cv_url, Stripe Connect id, notification priority flag, avg rating)
 * plus three fields sourced from the joined `users` row. The base class
 * declares `@Exclude()` so plain properties not exposed here are stripped
 * during serialisation.
 */
export class AdminConsultantProfileDetailResponseDto
  extends ConsultantProfileResponseDto
  implements IAdminConsultantProfileDetailResponse
{
  @Expose()
  @ApiProperty({
    name: 'cv_url',
    nullable: true,
    description: 'Presigned URL to the consultant CV; `null` when none uploaded.',
  })
  public readonly cv_url!: string | null;

  @Expose()
  @ApiProperty({
    name: 'stripe_connect_account_id',
    nullable: true,
    description: 'Stripe Connect account id linked for payouts; `null` when not connected.',
  })
  public readonly stripe_connect_account_id!: string | null;

  @Expose()
  @ApiProperty({ name: 'has_notification_priority', example: false })
  public readonly has_notification_priority!: boolean;

  @Expose()
  @Transform(({ value }: { value: string | null }) => (value === null ? null : parseFloat(value)))
  @ApiProperty({
    name: 'avg_rating',
    nullable: true,
    example: 92.5,
    description: 'Average rating across passed skill exams (0–100, 2 decimal places).',
  })
  public readonly avg_rating!: number | null;

  @Expose()
  @ApiProperty({ example: 'jane.doe@example.com' })
  public readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'register_date', description: 'Auth account creation timestamp.' })
  public readonly register_date!: Date;

  @Expose()
  @ApiProperty({
    name: 'last_login',
    nullable: true,
    description: 'Latest login timestamp for the linked auth account; null until first login.',
  })
  public readonly last_login!: Date | null;
}
