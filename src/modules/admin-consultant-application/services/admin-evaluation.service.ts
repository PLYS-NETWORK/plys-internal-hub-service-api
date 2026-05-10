import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ApplicationStatus, QuestionType } from '@database/enums';
import {
  FINAL_SCORE_ADMIN_WEIGHT,
  FINAL_SCORE_AI_WEIGHT,
} from '@modules/consultant-application/consultant-application.constants';
import { AdminManualScoreDto } from '@modules/consultant-application/dto/requests/admin-manual-score.dto';
import { InterviewQuestionResponseDto } from '@modules/consultant-application/dto/responses/interview-question-response.dto';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { IAdminEvaluationService } from '../interfaces/admin-evaluation.service.interface';

@Injectable()
export class AdminEvaluationService implements IAdminEvaluationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminEvaluationService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async getManualQuestions(applicationId: string): Promise<InterviewQuestionResponseDto[]> {
    this.logger.log(`[${this.rid}] getManualQuestions — start | applicationId: ${applicationId}`);

    const application = await this.uow.consultantApplications.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw new TranslatableException({
        messageKey: 'error.consultant_application.not_found',
        errorCode: ERROR_CODES.CONSULTANT_APPLICATION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (application.status !== ApplicationStatus.PENDING_ADMIN_EVALUATION) {
      throw new TranslatableException({
        messageKey: 'error.consultant_application.invalid_status',
        errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INVALID_STATUS,
        status: HttpStatus.CONFLICT,
      });
    }

    const [commQuestions, sysQuestions] = await Promise.all([
      this.uow.applicationQuestions.findByApplicationIdAndType(
        applicationId,
        QuestionType.COMMUNICATION,
      ),
      this.uow.applicationQuestions.findByApplicationIdAndType(
        applicationId,
        QuestionType.SYSTEM_KNOWLEDGE,
      ),
    ]);
    const assignedQuestions = [...commQuestions, ...sysQuestions].sort(
      (a, b) => a.questionOrder - b.questionOrder,
    );
    const answers = await this.uow.applicationAnswers.findByApplicationId(applicationId);
    const answerMap = new Map(answers.map((a) => [a.applicationQuestion?.id ?? '', a]));

    return assignedQuestions.map((aq) => {
      const answer = answerMap.get(aq.id);
      return plainToInstance(
        InterviewQuestionResponseDto,
        {
          id: aq.id,
          application_question_id: aq.id,
          question_order: aq.questionOrder,
          type: aq.type,
          content: aq.contentSnapshot,
          answer_text: answer?.answerText ?? null,
        },
        { excludeExtraneousValues: true },
      );
    });
  }

  /** @inheritdoc */
  public async submitManualEvaluation(
    applicationId: string,
    dto: AdminManualScoreDto,
  ): Promise<void> {
    const adminId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] submitManualEvaluation — start | applicationId: ${applicationId}, adminId: ${adminId}`,
    );

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

      if (application.status !== ApplicationStatus.PENDING_ADMIN_EVALUATION) {
        throw new TranslatableException({
          messageKey: 'error.consultant_application.invalid_status',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      // Save per-answer admin scores (numeric columns stored as string)
      for (const entry of dto.scores) {
        const answer = await tx.applicationAnswers.findOne({
          where: { applicationQuestionId: entry.applicationQuestionId },
        });
        if (answer) {
          answer.adminScore = String(entry.score);
          answer.adminNotes = entry.notes ?? null;
          await tx.applicationAnswers.save(answer);
        }
      }

      // Calculate final score: AI×60% + Admin×40%
      const aiEvalScore = parseFloat(application.aiEvalScore ?? '0');
      const finalScore = parseFloat(
        (
          aiEvalScore * FINAL_SCORE_AI_WEIGHT +
          dto.adminEvalScore * FINAL_SCORE_ADMIN_WEIGHT
        ).toFixed(2),
      );

      application.adminEvalScore = String(dto.adminEvalScore);
      application.adminEvalCompletedBy = adminId;
      application.adminEvalCompletedAt = new Date();
      application.finalScore = String(finalScore);
      application.status = ApplicationStatus.PENDING_FINAL_DECISION;
      await tx.consultantApplications.save(application);

      this.logger.log(
        `[${this.rid}] submitManualEvaluation — complete | applicationId: ${applicationId}, finalScore: ${finalScore}`,
      );
    });
  }
}
