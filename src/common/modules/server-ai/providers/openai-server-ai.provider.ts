import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import OpenAI from 'openai';

import { IServerAiProvider } from '../interfaces';

@Injectable()
export class OpenAiServerAiProvider implements IServerAiProvider {
  private readonly logger = new Logger(OpenAiServerAiProvider.name);

  /** @inheritdoc */
  public async complete(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    try {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
      });
      return response.choices[0]?.message?.content ?? '';
    } catch (err) {
      this.logger.error(`OpenAI completion failed | error: ${(err as Error).message}`);
      throw new InternalServerErrorException('AI provider request failed');
    }
  }
}
