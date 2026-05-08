import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AiProviderKeyService } from './ai-provider-key.service';
import { GetActiveKeyQueryDto } from './dto/requests';
import { ApiKeyBffResponseDto } from './dto/responses';

// `GET /ai-provider-keys/active` is the only public-ish endpoint in this
// module — it's hit by the FE BFF before opening a chat box. Authentication
// gates it (the global JwtAuthGuard runs first); admins are not required.
// Plaintext never leaves the BE — the response carries an envelope wrapped in
// FE_BFF_SECRET that only the FE BFF process can decrypt.
@ApiTags('AI Provider Keys')
@ApiBearerAuth()
@Controller('ai-provider-keys')
export class AiProviderKeyBffController {
  constructor(private readonly service: AiProviderKeyService) {}

  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the active key for a provider, encrypted under FE_BFF_SECRET',
    description:
      'Called by the FE BFF before opening a chat. Returns a `key_envelope` that ' +
      'the BFF decrypts with its FE_BFF_SECRET_v<version> to recover the plaintext ' +
      'API key. Browsers must never see the plaintext — that stays on the FE BFF.',
  })
  public async getActive(
    @Query() dto: GetActiveKeyQueryDto,
  ): Promise<ITranslatedPayload<ApiKeyBffResponseDto>> {
    const data = await this.service.getActiveKeyEnvelope(dto.provider);
    return { messageKey: 'success.ok', data };
  }
}
