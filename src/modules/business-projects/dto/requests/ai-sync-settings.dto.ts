import { MaxJsonSize } from '@common/validators/max-json-size.validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

const INTRODUCTION_MAX_BYTES = 50 * 1024;

// Mirror of the chunk of `UpdateProjectSettingsDto` the AI runner needs —
// `title`, `introduction`, `max_consultants`. Skills go through the dedicated
// `/ai-sync/skills` endpoint so the two operations don't overlap and the
// idempotency-key surface stays per-concern.
export class AiSyncSettingsDto {
  @Expose({ name: 'title' })
  @ApiPropertyOptional({ name: 'title', minLength: 3, maxLength: 300 })
  @IsOptional()
  @IsString()
  @Length(3, 300)
  public readonly title?: string;

  @Expose({ name: 'introduction' })
  @ApiPropertyOptional({
    name: 'introduction',
    type: 'object',
    additionalProperties: true,
    description:
      'Tiptap doc, opaque to the BE. Capped at 50 KB to defend against ' +
      'runaway payloads while leaving room for normal-sized rich text.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(INTRODUCTION_MAX_BYTES)
  public readonly introduction?: Record<string, unknown> | null;

  @Expose({ name: 'max_consultants' })
  @ApiPropertyOptional({ name: 'max_consultants', minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  public readonly maxConsultants?: number;
}
