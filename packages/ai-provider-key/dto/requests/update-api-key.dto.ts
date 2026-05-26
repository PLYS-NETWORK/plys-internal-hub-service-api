import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

import { IUpdateApiKeyRequest } from './interfaces/update-api-key.request.interface';

// Only label/model are mutable. The plaintext key cannot be rotated in place —
// admins must create a new row and activate it (the partial unique index
// keeps the active-key invariant).
export class UpdateApiKeyDto implements IUpdateApiKeyRequest {
  @Expose({ name: 'model' })
  @ApiPropertyOptional({ name: 'model', example: 'llama-3.3-70b-versatile' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  public readonly model?: string;

  @Expose({ name: 'label' })
  @ApiPropertyOptional({ name: 'label', example: 'groq-prod-2026-05' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  public readonly label?: string;
}
