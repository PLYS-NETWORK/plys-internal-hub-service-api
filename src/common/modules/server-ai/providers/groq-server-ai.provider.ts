import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';

import { IServerAiProvider } from '../interfaces';

@Injectable()
export class GroqServerAiProvider implements IServerAiProvider {
  private readonly logger = new Logger(GroqServerAiProvider.name);

  /** @inheritdoc */
  public async complete(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    try {
      const client = new Groq({ apiKey });
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
      this.logger.error(`Groq completion failed | error: ${(err as Error).message}`);
      throw new InternalServerErrorException('AI provider request failed');
    }
  }
}
