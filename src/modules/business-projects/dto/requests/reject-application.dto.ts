import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectApplicationDto {
  @Expose({ name: 'rejection_reason' })
  @ApiPropertyOptional({ name: 'rejection_reason', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public readonly rejectionReason?: string;
}
