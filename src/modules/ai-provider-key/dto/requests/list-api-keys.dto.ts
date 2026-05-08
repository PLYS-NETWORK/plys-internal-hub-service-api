import { PageOptionsDto } from '@common/dto/page-options.dto';
import { AiAssistantType } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IListApiKeysRequest } from './interfaces/list-api-keys.request.interface';

const KEYWORDS_MIN = 1;
const KEYWORDS_MAX = 80;
const MODEL_MAX = 80;

// Query params for `GET /admin/ai-provider-keys`. Extends the standard
// pagination options (page/limit/sort_by/order_by — all snake_case in the
// query string) with three vault-specific filters. The service layer
// always orders active keys first regardless of `sort_by`, so on page 1 the
// admin sees the keys currently in rotation at the top.
export class ListApiKeysDto extends PageOptionsDto implements IListApiKeysRequest {
  @Expose({ name: 'assistant_type' })
  @ApiPropertyOptional({
    name: 'assistant_type',
    enum: AiAssistantType,
    description: 'Filter to one assistant feature.',
  })
  @IsEnum(AiAssistantType)
  @IsOptional()
  public readonly assistantType?: AiAssistantType;

  @Expose({ name: 'model' })
  @ApiPropertyOptional({
    name: 'model',
    description: 'Exact-match filter on the model identifier.',
    maxLength: MODEL_MAX,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(MODEL_MAX)
  @IsOptional()
  public readonly model?: string;

  @Expose({ name: 'keywords' })
  @ApiPropertyOptional({
    name: 'keywords',
    description: 'Case-insensitive substring search on `label`.',
    minLength: KEYWORDS_MIN,
    maxLength: KEYWORDS_MAX,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(KEYWORDS_MIN)
  @MaxLength(KEYWORDS_MAX)
  @IsOptional()
  public readonly keywords?: string;
}
