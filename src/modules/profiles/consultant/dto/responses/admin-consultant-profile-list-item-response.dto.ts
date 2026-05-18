import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

import { IAdminConsultantProfileListItemResponse } from './interfaces/admin-consultant-profile-list-item.response.interface';

@Exclude()
export class AdminConsultantProfileListItemResponseDto implements IAdminConsultantProfileListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly user_id!: string;

  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Jane Doe' })
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;

  @Expose()
  @ApiProperty({ example: 'jane.doe@example.com' })
  public readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'phone_number', nullable: true, example: '+14155552671' })
  public readonly phone_number!: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly city!: string | null;

  @Expose()
  @ApiProperty({ name: 'country_code', nullable: true, example: 'US' })
  public readonly country_code!: string | null;

  @Expose()
  @ApiProperty({ name: 'years_of_experience', nullable: true, example: 5 })
  public readonly years_of_experience!: number | null;

  @Expose()
  @ApiProperty({ name: 'is_verified', example: true })
  public readonly is_verified!: boolean;

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
  @ApiProperty({ name: 'register_date' })
  public readonly register_date!: Date;

  @Expose()
  @ApiProperty({ name: 'last_login', nullable: true })
  public readonly last_login!: Date | null;
}
