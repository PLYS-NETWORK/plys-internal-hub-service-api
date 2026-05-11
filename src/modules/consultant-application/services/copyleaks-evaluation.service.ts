import { ERROR_CODES } from '@common/constants/error-codes';
import { NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { CopyleaksService } from '@common/modules/copyleaks/copyleaks.service';
import { EmailService } from '@common/modules/email/email.service';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ApplicationStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { InjectQueue } from '@nestjs/bull';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';

import {
  BLOCK_MONTHS,
  CONSULTANT_APPLICATION_JOBS,
  CONSULTANT_APPLICATION_QUEUE,
  COPYLEAKS_PASS_MAX_AI_SCORE,
} from '../consultant-application.constants';
import { ICopyleaksEvaluationService } from '../interfaces/application-evaluation.service.interface';

@Injectable()
export class CopyleaksEvaluationService implements ICopyleaksEvaluationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly copyleaksService: CopyleaksService,
    private readonly emailService: EmailService,
    private readonly requestContext: RequestContextService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(CONSULTANT_APPLICATION_QUEUE)
    private readonly queue: Queue,
  ) {
    this.logger = new AppLogger(CopyleaksEvaluationService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async runCopyleaksEvaluation(applicationId: string): Promise<void> {
    this.logger.log(
      `[${this.rid}] runCopyleaksEvaluation — start | applicationId: ${applicationId}`,
    );

    const answers = await this.uow.applicationAnswers.findByApplicationId(applicationId);
    if (answers.length === 0) {
      this.logger.warn(
        `[${this.rid}] runCopyleaksEvaluation — no answers | applicationId: ${applicationId}`,
      );
      return;
    }

    const texts = answers.map((a) => a.answerText);
    const result = await this.copyleaksService.checkTextsForAi(texts);

    // Compute average AI score across all answers
    const scores = result.results.map((r) => r.aiScore);
    const aggregateScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    await this.uow.withTransaction(async (tx) => {
      const application = await tx.consultantApplications.findOne({
        where: { id: applicationId },
        relations: ['user'],
      });

      if (!application) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.not_found',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Save per-answer copyleaks scores (numeric columns stored as string)
      for (let i = 0; i < answers.length; i++) {
        answers[i].copyleaksAiScore = String(parseFloat(scores[i].toFixed(2)));
        await tx.applicationAnswers.save(answers[i]);
      }

      application.copyleaksScore = String(parseFloat(aggregateScore.toFixed(2)));
      application.copyleaksCheckedAt = new Date();

      if (aggregateScore < COPYLEAKS_PASS_MAX_AI_SCORE) {
        // Pass: originality > 70%
        application.status = ApplicationStatus.PENDING_AI_EVALUATION;
        await tx.consultantApplications.save(application);

        this.logger.log(
          `[${this.rid}] runCopyleaksEvaluation — passed | applicationId: ${applicationId}, score: ${aggregateScore.toFixed(2)}`,
        );
      } else {
        // Fail: too much AI-generated content
        const blockedUntil = new Date();
        blockedUntil.setMonth(blockedUntil.getMonth() + BLOCK_MONTHS);

        application.status = ApplicationStatus.COPYLEAKS_FAILED;
        application.blockedUntil = blockedUntil;
        application.rejectionReason = 'COPYLEAKS_FAILED';
        await tx.consultantApplications.save(application);

        this.logger.warn(
          `[${this.rid}] runCopyleaksEvaluation — failed | applicationId: ${applicationId}, score: ${aggregateScore.toFixed(2)}`,
        );

        this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_APPLICATION_AI_REJECTED, {
          application_id: application.id,
          consultant_user_id: application.user.id,
          consultant_name: application.user.email,
        });

        // Send rejection email
        void this.emailService
          .sendApplicationRejectedEmail(application.user.email, {
            userName: application.user.email,
            reason:
              'AI-generated content was detected in your answers. This violates our interview policy.',
            blockedUntil: blockedUntil.toISOString(),
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `[${this.rid}] runCopyleaksEvaluation — email failed | applicationId: ${applicationId} | error: ${msg}`,
            );
          });
      }
    });

    // Dispatch AI evaluation job if Copyleaks passed
    const updated = await this.uow.consultantApplications.findOne({
      where: { id: applicationId },
    });

    if (updated?.status === ApplicationStatus.PENDING_AI_EVALUATION) {
      await this.queue.add(
        CONSULTANT_APPLICATION_JOBS.RUN_AI_EVALUATION,
        { applicationId },
        { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
      );
    }

    this.logger.log(
      `[${this.rid}] runCopyleaksEvaluation — complete | applicationId: ${applicationId}`,
    );
  }
}
