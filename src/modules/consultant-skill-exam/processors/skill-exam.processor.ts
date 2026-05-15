import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

import {
  ISkillExamJobPayload,
  SKILL_EXAM_JOBS,
  SKILL_EXAM_QUEUE,
} from '../consultant-skill-exam.constants';
import { SkillExamAiEvaluationService } from '../services/skill-exam-ai-evaluation.service';
import { SkillExamCopyleaksService } from '../services/skill-exam-copyleaks.service';

@Processor(SKILL_EXAM_QUEUE)
export class SkillExamProcessor {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly requestContext: RequestContextService,
    private readonly aiEval: SkillExamAiEvaluationService,
    private readonly copyleaks: SkillExamCopyleaksService,
  ) {
    this.logger = new AppLogger(SkillExamProcessor.name, requestContext);
  }

  @Process(SKILL_EXAM_JOBS.GENERATE_SKILL_EXAM_QUESTIONS)
  public async handleGenerate(job: Job<ISkillExamJobPayload>): Promise<void> {
    this.logger.log(`[${this.rid}] handleGenerate — start | examId: ${job.data.exam_id}`);
    try {
      await this.aiEval.generateQuestions(job.data.exam_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] handleGenerate — failed | examId: ${job.data.exam_id} | error: ${msg}`,
      );
      throw err;
    }
  }

  @Process(SKILL_EXAM_JOBS.RUN_SKILL_EXAM_COPYLEAKS)
  public async handleCopyleaks(job: Job<ISkillExamJobPayload>): Promise<void> {
    this.logger.log(`[${this.rid}] handleCopyleaks — start | examId: ${job.data.exam_id}`);
    try {
      await this.copyleaks.run(job.data.exam_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] handleCopyleaks — failed | examId: ${job.data.exam_id} | error: ${msg}`,
      );
      throw err;
    }
  }

  @Process(SKILL_EXAM_JOBS.RUN_SKILL_EXAM_AI_EVAL)
  public async handleAiEval(job: Job<ISkillExamJobPayload>): Promise<void> {
    this.logger.log(`[${this.rid}] handleAiEval — start | examId: ${job.data.exam_id}`);
    try {
      await this.aiEval.run(job.data.exam_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] handleAiEval — failed | examId: ${job.data.exam_id} | error: ${msg}`,
      );
      throw err;
    }
  }
}
