import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { ICopyleaksProvider } from '../interfaces/copyleaks-provider.interface';
import { ICopyleaksAiResult } from '../interfaces/copyleaks-result.interface';

/**
 * Concrete Strategy: detects AI-generated content via the Copyleaks
 * Writing Assistant / AI Content Detection API.
 *
 * API Reference: https://api.copyleaks.com/v2/writer-detector
 *
 * To swap providers (e.g. GPTZero), create a new class implementing
 * ICopyleaksProvider and update the binding in CopyleaksModule.
 */
@Injectable()
export class CopyleaksApiProvider implements ICopyleaksProvider {
  private readonly logger = new Logger(CopyleaksApiProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.copyleaks.com/v2/writer-detector';

  constructor(private readonly env: EnvironmentsService) {
    this.apiKey = this.env.copyleaksApiKey;
  }

  /** @inheritdoc */
  public async checkAiContent(text: string): Promise<ICopyleaksAiResult> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Copyleaks API error | status: ${response.status} | body: ${errorBody}`);
      throw new Error(`Copyleaks API returned status ${response.status}`);
    }

    const data = (await response.json()) as { summary: { ai: number } };

    // Copyleaks returns `summary.ai` as a decimal (0–1), we normalise to 0–100.
    const aiScore = Math.round((data.summary?.ai ?? 0) * 100);

    return {
      aiScore,
      isAiGenerated: aiScore > 80,
    };
  }
}
