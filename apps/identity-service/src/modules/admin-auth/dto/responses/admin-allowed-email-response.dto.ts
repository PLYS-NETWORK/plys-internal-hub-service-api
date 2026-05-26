import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IAdminAllowedEmailResponse } from './interfaces/admin-allowed-email.response.interface';

@Exclude()
export class AdminAllowedEmailResponseDto implements IAdminAllowedEmailResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'admin@plysnetwork.com' })
  public readonly email!: string;

  @Expose()
  @ApiProperty({ example: 'ADMIN_PLATFORM', enum: ['ADMIN_PLATFORM', 'TASK_REVIEWER'] })
  public readonly role!: string;

  @Expose()
  @ApiProperty({ name: 'is_active', example: true })
  public readonly is_active!: boolean;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({
    name: 'last_login',
    nullable: true,
    description: 'Latest sign-in timestamp; null until the invited admin first logs in.',
  })
  public readonly last_login!: Date | null;
}
