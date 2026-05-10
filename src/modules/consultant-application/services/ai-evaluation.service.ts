import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ServerAiService } from '@common/modules/server-ai/server-ai.service';
import { AiAssistantType, ApplicationStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { IAiEvaluationService } from '../interfaces/application-evaluation.service.interface';

interface IAiAnswerScore {
  order: number;
  score: number;
  feedback: string;
}

interface IAiEvaluationResponse {
  overall_score: number;
  answers: IAiAnswerScore[];
}

@Injectable()
export class AiEvaluationService implements IAiEvaluationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly serverAiService: ServerAiService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AiEvaluationService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async runAiEvaluation(applicationId: string): Promise<void> {
    this.logger.log(`[${this.rid}] runAiEvaluation — start | applicationId: ${applicationId}`);

    const assignedQuestions =
      await this.uow.applicationQuestions.findByApplicationId(applicationId);
    const answers = await this.uow.applicationAnswers.findByApplicationId(applicationId);
    const answerMap = new Map(answers.map((a) => [a.applicationQuestion?.id ?? '', a]));

    const qaPairs = assignedQuestions
      .map((aq) => {
        const answer = answerMap.get(aq.id);
        return {
          order: aq.questionOrder,
          question: aq.contentSnapshot,
          answer: answer?.answerText ?? '',
        };
      })
      .filter((qa) => qa.answer.length > 0);

    const systemPrompt = `You are an expert technical recruiter evaluating consultant interview answers.
Score each answer from 0 to 100 based on: clarity, depth, relevance, and professionalism.
Return ONLY valid JSON matching this schema exactly:
{
  "overall_score": <number 0-100>,
  "answers": [
    { "order": <question_order>, "score": <number 0-100>, "feedback": "<one sentence>" }
  ]
}
Do not include any other text outside the JSON.`;

    const userPrompt = qaPairs
      .map((qa) => `Q${qa.order}: ${qa.question}\nA${qa.order}: ${qa.answer}`)
      .join('\n\n');

    const rawResponse = await this.serverAiService.complete(
      AiAssistantType.EVALUATE_ANSWER,
      systemPrompt,
      userPrompt,
    );

    let parsed: IAiEvaluationResponse;
    try {
      parsed = JSON.parse(rawResponse) as IAiEvaluationResponse;
    } catch {
      this.logger.error(
        `[${this.rid}] runAiEvaluation — invalid AI response | applicationId: ${applicationId}`,
      );
      throw new Error(
        `AI evaluation returned unparseable response for application ${applicationId}`,
      );
    }

    await this.uow.withTransaction(async (tx) => {
      const application = await tx.consultantApplications.findOne({
        where: { id: applicationId },
      });

      if (!application) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.not_found',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Save per-answer AI scores (entity column is numeric → stored as string)
      const scoresByOrder = new Map(parsed.answers.map((a) => [a.order, a]));

      for (const aq of assignedQuestions) {
        const answer = answerMap.get(aq.id);
        const aiAnswer = scoresByOrder.get(aq.questionOrder);
        if (answer && aiAnswer) {
          answer.aiEvalScore = String(parseFloat(aiAnswer.score.toFixed(2)));
          answer.aiFeedback = aiAnswer.feedback;
          await tx.applicationAnswers.save(answer);
        }
      }

      application.aiEvalScore = String(parseFloat(parsed.overall_score.toFixed(2)));
      application.aiEvalCompletedAt = new Date();
      application.status = ApplicationStatus.PENDING_ADMIN_EVALUATION;
      await tx.consultantApplications.save(application);
    });

    this.logger.log(
      `[${this.rid}] runAiEvaluation — complete | applicationId: ${applicationId}, score: ${parsed.overall_score}`,
    );
  }
}
