import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import { IServerAiProvider } from '../interfaces';

@Injectable()
export class GoogleServerAiProvider implements IServerAiProvider {
  private readonly logger = new Logger(GoogleServerAiProvider.name);

  /** @inheritdoc */
  public async complete(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    try {
      const client = new GoogleGenerativeAI(apiKey);
      const generativeModel = client.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
      });
      const result = await generativeModel.generateContent(userPrompt);
      return result.response.text();
    } catch (err) {
      this.logger.error(`Google AI completion failed | error: ${(err as Error).message}`);
      throw new InternalServerErrorException('AI provider request failed');
    }
  }
}
