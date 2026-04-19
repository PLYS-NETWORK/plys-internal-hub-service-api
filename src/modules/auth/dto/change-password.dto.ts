import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ name: 'current_password' })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['current_password'])
  @IsString()
  readonly currentPassword!: string;

  @ApiProperty({ name: 'new_password', minLength: 8 })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['new_password'])
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  readonly newPassword!: string;
}
