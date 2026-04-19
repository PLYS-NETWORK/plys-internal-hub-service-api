import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'john@example.com' })
  readonly email!: string;

  @Expose({ name: 'is_email_verified' })
  @ApiProperty({ name: 'is_email_verified', example: true })
  readonly isEmailVerified!: boolean;

  @Expose({ name: 'is_active' })
  @ApiProperty({ name: 'is_active', example: true })
  readonly isActive!: boolean;
}
