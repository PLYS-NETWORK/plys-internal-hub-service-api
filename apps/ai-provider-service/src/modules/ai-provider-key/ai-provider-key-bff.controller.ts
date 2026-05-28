import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { AiProviderKeyService } from './ai-provider-key.service';
import { GetActiveKeyQueryDto } from './dto/requests';
import { ApiKeyBffResponseDto } from './dto/responses';
// `GET /ai-provider-keys/active` is called exclusively by the FE BFF before opening
// a chat box. JWT is not used — the BFF presents `x-api-key` instead so end-user
// sessions cannot exfiltrate encrypted key envelopes.
@ApiSecurity('x-api-key')
@Controller('ai-provider-keys')
export class AiProviderKeyBffController {
  constructor(private readonly service: AiProviderKeyService) {}
  @Public()
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Shared BFF secret' })
  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the active key for an assistant type, encrypted under FE_BFF_SECRET',
    description:
      'Called by the FE BFF before invoking an AI assistant. The query specifies ' +
      'which assistant feature is making the call (chat_box / interview / ' +
      'evaluate_answer). Returns a `key_envelope` that the BFF decrypts with its ' +
      'FE_BFF_SECRET_v<version> to recover the plaintext API key. Browsers must ' +
      'never see the plaintext — that stays on the FE BFF.',
  })
  public async getActive(
    @Query() dto: GetActiveKeyQueryDto,
  ): Promise<ITranslatedPayload<ApiKeyBffResponseDto>> {
    const data = await this.service.getActiveKeyEnvelope(dto.assistantType);
    return { messageKey: 'success.ok', data };
  }
}
