import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { AiProviderKeyService } from './ai-provider-key.service';
import { CreateApiKeyDto, ListApiKeysDto, UpdateApiKeyDto } from './dto/requests';
import { ApiKeyAdminResponseDto } from './dto/responses';
// Admin CRUD for the AI provider key vault. Mounted under
// `/admin/ai-provider-keys`. The global JwtAuthGuard runs first;
// `@Roles(UserRole.ADMIN_PLATFORM)` adds the role check. Plaintext keys cross
// the wire only on POST creates and are never echoed back.
@Controller('admin/ai-provider-keys')
export class AiProviderKeyAdminController {
  constructor(private readonly service: AiProviderKeyService) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List AI provider keys (masked, paginated) (Admin only)',
    description:
      'Paginated. Optional filters: `assistant_type` (enum), `model` (exact match), ' +
      'and `keywords` (case-insensitive substring search on `label`). Active keys ' +
      'are always sorted ahead of inactive ones, so page 1 surfaces the keys ' +
      'currently in rotation at the top.',
  })
  public async list(
    @Query() dto: ListApiKeysDto,
  ): Promise<ITranslatedPayload<PageDto<ApiKeyAdminResponseDto>>> {
    const data = await this.service.list(dto);
    return { messageKey: 'success.ok', data };
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create and activate a new AI provider key (Admin only)',
    description:
      'Plaintext is read once, encrypted under the current AI_KEYS_MASTER_KEY ' +
      'version, then discarded. The new key is created `is_active = true` and any ' +
      'previously active key for the same `assistant_type` is auto-deactivated in ' +
      'the same transaction — so creating a key is a one-step rotation. To bring ' +
      'an existing inactive key back into rotation without uploading new plaintext, ' +
      'use `PATCH /admin/ai-provider-keys/:id/activate` instead.',
  })
  public async create(
    @Body() dto: CreateApiKeyDto,
  ): Promise<ITranslatedPayload<ApiKeyAdminResponseDto>> {
    const data = await this.service.create(dto);
    return { messageKey: 'success.created', data };
  }
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update label/model on an AI provider key (Admin only)',
    description:
      'Plaintext key cannot be rotated in place. To rotate the secret, create ' +
      'a new row and activate it — the partial unique index keeps the active-key ' +
      'invariant safe.',
  })
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApiKeyDto,
  ): Promise<ITranslatedPayload<ApiKeyAdminResponseDto>> {
    const data = await this.service.update(id, dto);
    return { messageKey: 'success.ok', data };
  }
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Activate this key, deactivating any prior active key for the same assistant_type (Admin only)',
    description:
      'Side effect: in a single transaction, the previously active key for the ' +
      'same `assistant_type` (if any) is set to `is_active = false` before the ' +
      'target row is set to `is_active = true`. The partial unique index ' +
      '`uq_ai_provider_api_key_active_per_assistant_type` keeps the "at most one ' +
      'active key per assistant_type" invariant safe under races.',
  })
  public async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ApiKeyAdminResponseDto>> {
    const data = await this.service.activate(id);
    return { messageKey: 'success.ok', data };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke an AI provider key (Admin only)',
    description:
      'Refuses with 409 AI_PROVIDER_KEY_ACTIVE_REQUIRES_REPLACEMENT if the ' +
      'target is the only active key for the provider — admins must activate ' +
      'a replacement first.',
  })
  public async revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.revoke(id);
  }
  @Post('_re-encrypt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-encrypt every row to the current master key version (Admin only)',
    description:
      'Run after rotating AI_KEYS_MASTER_KEY. Idempotent: rows already on the ' +
      'current version are skipped. The body is empty; returns the count of rows ' +
      'that were rewritten.',
  })
  public async reEncrypt(): Promise<ITranslatedPayload<{ touched: number }>> {
    const touched = await this.service.reEncryptAll();
    return { messageKey: 'success.ok', data: { touched } };
  }
}
