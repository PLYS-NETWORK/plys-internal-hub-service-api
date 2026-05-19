import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Injectable } from '@nestjs/common';

import {
  IAiQualityCheckParams,
  IAiQualityCheckResult,
  IAiQualityCheckService,
} from '../interfaces/ai-quality-check.service.interface';

/**
 * Stub implementation of the 3+1 AI gate. Currently returns PASS unconditionally
 * so the workflow can complete end-to-end while the real LLM / plagiarism
 * provider is being designed. Swap this provider out in the module wiring
 * when the production integration lands.
 */
@Injectable()
export class AiQualityCheckService implements IAiQualityCheckService {
  private readonly logger: AppLogger;

  constructor(private readonly requestContext: RequestContextService) {
    this.logger = new AppLogger(AiQualityCheckService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async evaluate(params: IAiQualityCheckParams): Promise<IAiQualityCheckResult> {
    this.logger.log(
      `[${this.rid}] evaluate — start | taskId: ${params.taskId}, round: ${params.roundNumber}`,
    );
    // Stub: unconditional PASS until the real provider is wired in.
    const result: IAiQualityCheckResult = { decision: 'pass' };
    this.logger.log(
      `[${this.rid}] evaluate — complete | taskId: ${params.taskId}, decision: ${result.decision}`,
    );
    return result;
  }
}
