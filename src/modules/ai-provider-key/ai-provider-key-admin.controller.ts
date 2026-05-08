import { Roles } from '@common/decorators/roles.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { UserRole } from '@database/enums';
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AiProviderKeyService } from './ai-provider-key.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/requests';
import { ApiKeyAdminResponseDto } from './dto/responses';

// Admin CRUD for the AI provider key vault. Mounted under
// `/admin/ai-provider-keys`. The global JwtAuthGuard runs first;
// `@Roles(UserRole.ADMIN_PLATFORM)` adds the role check. Plaintext keys cross
// the wire only on POST creates and are never echoed back.
@ApiTags('Admin - AI Provider Keys')
@ApiBearerAuth()
@Controller('admin/ai-provider-keys')
@Roles(UserRole.ADMIN_PLATFORM)
export class AiProviderKeyAdminController {
  constructor(private readonly service: AiProviderKeyService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all AI provider keys (masked) (Admin only)' })
  public async list(): Promise<ITranslatedPayload<ApiKeyAdminResponseDto[]>> {
    const data = await this.service.list();
    return { messageKey: 'success.ok', data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new AI provider key (Admin only)',
    description:
      'Plaintext is read once, encrypted under the current AI_KEYS_MASTER_KEY ' +
      'version, then discarded. The new key is created `is_active = false`; ' +
      'admins must explicitly activate it before the BFF can fetch it.',
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
      'Activate this key, deactivating any prior active key for the same provider (Admin only)',
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
