import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ name: 'token', example: 'abc123...' })
  @IsString()
  public readonly token!: string;
}
