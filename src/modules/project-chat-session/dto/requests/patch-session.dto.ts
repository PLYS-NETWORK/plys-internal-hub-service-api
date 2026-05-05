import { ChatMessageRole } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  IAppendMessageRequest,
  IPatchSessionRequest,
} from './interfaces/append-message.request.interface';

// `parts` is `unknown` because the AI SDK's UIMessage shape is itself a
// discriminated union the BE doesn't need to introspect — we just persist and
// echo back. We do enforce the wire shape is *something* (`@IsObject` would
// over-restrict; arrays are valid). Length-cap protection comes from the
// session-level 200-message limit + the per-row JSONB toast threshold.
export class AppendMessageDto implements IAppendMessageRequest {
  @Expose({ name: 'role' })
  @ApiPropertyOptional({ name: 'role', enum: ChatMessageRole })
  @IsEnum(ChatMessageRole)
  public readonly role!: ChatMessageRole;

  @Expose({ name: 'parts' })
  @ApiPropertyOptional({
    name: 'parts',
    description: 'Vercel AI SDK UIMessage `parts` payload (array of typed segments).',
  })
  public readonly parts!: unknown;

  @Expose({ name: 'metadata' })
  @ApiPropertyOptional({
    name: 'metadata',
    description: 'Optional AI SDK metadata (tool-call IDs, citations, …).',
  })
  @IsOptional()
  @IsObject()
  public readonly metadata?: Record<string, unknown> | null;
}

export class PatchSessionDto implements IPatchSessionRequest {
  @Expose({ name: 'append_messages' })
  @ApiPropertyOptional({
    name: 'append_messages',
    type: () => [AppendMessageDto],
    description:
      'Up to 50 new messages to append, in chronological order. Newer messages ' +
      'go in later positions; the BE allocates a per-session ordinal `seq` ' +
      'inside the same transaction.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AppendMessageDto)
  public readonly appendMessages?: AppendMessageDto[];

  @Expose({ name: 'draft' })
  @ApiPropertyOptional({
    name: 'draft',
    description:
      'Replaces the session-level draft state in full. Free-form FE working ' +
      'state — never read by the BE. Cap at 64 KB at the call site if needed.',
  })
  @IsOptional()
  @IsObject()
  public readonly draft?: Record<string, unknown>;

  @Expose({ name: 'stage' })
  @ApiPropertyOptional({
    name: 'stage',
    description:
      'Optional FE-driven sub-state for PLANNING (e.g. ANALYZE / TASK_REVIEW). ' +
      'Pass `null` to clear; omit to leave unchanged.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public readonly stage?: string | null;
}
