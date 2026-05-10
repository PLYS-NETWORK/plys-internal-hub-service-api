import { AiAssistantType, AiProvider } from '@database/enums';
import { MasterKeyCipher } from '@modules/ai-provider-key/crypto/master-key.cipher';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import { IServerAiService } from './interfaces/server-ai.service.interface';
import { IServerAiProvider } from './interfaces/server-ai-provider.interface';
import { GoogleServerAiProvider } from './providers/google-server-ai.provider';
import { GroqServerAiProvider } from './providers/groq-server-ai.provider';
import { OpenAiServerAiProvider } from './providers/openai-server-ai.provider';

@Injectable()
export class ServerAiService implements IServerAiService {
  private readonly logger = new Logger(ServerAiService.name);

  private readonly providerMap: Record<AiProvider, IServerAiProvider>;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly masterKeyCipher: MasterKeyCipher,
    private readonly openAiProvider: OpenAiServerAiProvider,
    private readonly groqProvider: GroqServerAiProvider,
    private readonly googleProvider: GoogleServerAiProvider,
  ) {
    this.providerMap = {
      [AiProvider.OPENAI]: this.openAiProvider,
      [AiProvider.GROQ]: this.groqProvider,
      [AiProvider.GEMINI]: this.googleProvider,
    };
  }

  /** @inheritdoc */
  public async complete(
    assistantType: AiAssistantType,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    this.logger.log(`ServerAiService.complete — start | assistantType: ${assistantType}`);

    const keyRecord = await this.uow.aiProviderApiKeys.findOne({
      where: { assistantType, isActive: true },
    });

    if (!keyRecord) {
      this.logger.error(
        `ServerAiService.complete — failed | no active key for assistantType: ${assistantType}`,
      );
      throw new InternalServerErrorException(
        `No active AI key configured for assistant type: ${assistantType}`,
      );
    }

    const plaintextKey = this.masterKeyCipher.decrypt(keyRecord.keyCiphertext);
    const provider = this.providerMap[keyRecord.provider];

    if (!provider) {
      this.logger.error(
        `ServerAiService.complete — failed | unsupported provider: ${keyRecord.provider}`,
      );
      throw new InternalServerErrorException(`Unsupported AI provider: ${keyRecord.provider}`);
    }

    const result = await provider.complete(keyRecord.model, plaintextKey, systemPrompt, userPrompt);

    this.logger.log(
      `ServerAiService.complete — complete | assistantType: ${assistantType}, provider: ${keyRecord.provider}, model: ${keyRecord.model}`,
    );

    return result;
  }
}
