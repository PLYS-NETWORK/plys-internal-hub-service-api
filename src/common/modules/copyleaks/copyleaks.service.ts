import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { COPYLEAKS_PROVIDER_TOKEN } from './constants';
import { ICopyleaksProvider } from './interfaces/copyleaks-provider.interface';
import {
  ICopyleaksAggregateResult,
  ICopyleaksAiResult,
} from './interfaces/copyleaks-result.interface';

/**
 * CopyleaksService is the context in the Strategy Pattern.
 * It is completely decoupled from the detection mechanism — it only knows
 * the ICopyleaksProvider interface. Swapping Copyleaks for another provider
 * requires no changes here.
 */
@Injectable()
export class CopyleaksService {
  private readonly logger = new Logger(CopyleaksService.name);

  constructor(
    @Inject(COPYLEAKS_PROVIDER_TOKEN)
    private readonly provider: ICopyleaksProvider,
    private readonly requestContext: RequestContextService,
  ) {}

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /**
   * Checks multiple text inputs for AI-generated content.
   * Returns an aggregate result with the highest score and per-text breakdown.
   */
  public async checkTextsForAi(texts: string[]): Promise<ICopyleaksAggregateResult> {
    this.logger.log(`[${this.rid}] checkTextsForAi — start | count: ${texts.length}`);

    const results: ICopyleaksAiResult[] = [];

    // Why sequential: Copyleaks rate-limits per API key; parallel bursts
    // risk 429 responses. Sequential calls stay within limits for typical
    // application volumes (1-10 interview answers).
    for (const text of texts) {
      const result = await this.provider.checkAiContent(text);
      results.push(result);
    }

    const maxAiScore = results.reduce((max, r) => Math.max(max, r.aiScore), 0);
    const hasAiContent = maxAiScore > 80;

    this.logger.log(
      `[${this.rid}] checkTextsForAi — complete | maxAiScore: ${maxAiScore}, hasAiContent: ${hasAiContent}`,
    );

    return { maxAiScore, hasAiContent, results };
  }
}
