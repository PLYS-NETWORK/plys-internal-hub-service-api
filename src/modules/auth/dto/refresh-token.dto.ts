import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ name: 'refresh_token' })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['refresh_token'])
  @IsString()
  readonly refreshToken!: string;
}
