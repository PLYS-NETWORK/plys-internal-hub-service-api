import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { InterviewQuestion } from '@database/entities';
import { QuestionType } from '@database/enums';
import { CreateInterviewQuestionDto } from '@modules/consultant-application/dto/requests/create-interview-question.dto';
import { UpdateInterviewQuestionDto } from '@modules/consultant-application/dto/requests/update-interview-question.dto';
import { InterviewQuestionBankResponseDto } from '@modules/consultant-application/dto/responses/interview-question-bank-response.dto';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { IInterviewQuestionBankService } from '../interfaces/interview-question-bank.service.interface';

@Injectable()
export class InterviewQuestionBankService implements IInterviewQuestionBankService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(InterviewQuestionBankService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async list(filters?: {
    type?: string;
    isActive?: boolean;
  }): Promise<InterviewQuestionBankResponseDto[]> {
    this.logger.log(`[${this.rid}] list — start`);

    const where: Partial<{ type: QuestionType; isActive: boolean }> = {};
    if (filters?.type) {
      where.type = filters.type as QuestionType;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const questions = await this.uow.interviewQuestions.find({
      where,
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    return questions.map((q) => this.toDto(q));
  }

  /** @inheritdoc */
  public async create(dto: CreateInterviewQuestionDto): Promise<InterviewQuestionBankResponseDto> {
    this.logger.log(`[${this.rid}] create — start | type: ${dto.type}`);

    // Guard against unexpected SKILL_BASED type despite DTO validation — belt-and-suspenders
    if ((dto.type as QuestionType) === QuestionType.SKILL_BASED) {
      throw new TranslatableException({
        messageKey: 'error.interview_question.invalid_type',
        errorCode: ERROR_CODES.INTERVIEW_QUESTION_INVALID_TYPE,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const question = this.uow.interviewQuestions.create({
      type: dto.type,
      content: dto.content,
      displayOrder: dto.displayOrder ?? null,
      isActive: true,
    }) as InterviewQuestion;

    const saved = await this.uow.interviewQuestions.save(question);
    this.logger.log(`[${this.rid}] create — complete | id: ${saved.id}`);
    return this.toDto(saved);
  }

  /** @inheritdoc */
  public async update(
    questionId: string,
    dto: UpdateInterviewQuestionDto,
  ): Promise<InterviewQuestionBankResponseDto> {
    this.logger.log(`[${this.rid}] update — start | questionId: ${questionId}`);

    const question = await this.uow.interviewQuestions.findOne({ where: { id: questionId } });
    if (!question) {
      throw new TranslatableException({
        messageKey: 'error.interview_question.not_found',
        errorCode: ERROR_CODES.INTERVIEW_QUESTION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (dto.content !== undefined) {
      question.content = dto.content;
    }
    if (dto.displayOrder !== undefined) {
      question.displayOrder = dto.displayOrder;
    }

    const saved = await this.uow.interviewQuestions.save(question);
    this.logger.log(`[${this.rid}] update — complete | questionId: ${questionId}`);
    return this.toDto(saved);
  }

  /** @inheritdoc */
  public async toggleActive(questionId: string): Promise<InterviewQuestionBankResponseDto> {
    this.logger.log(`[${this.rid}] toggleActive — start | questionId: ${questionId}`);

    const question = await this.uow.interviewQuestions.findOne({ where: { id: questionId } });
    if (!question) {
      throw new TranslatableException({
        messageKey: 'error.interview_question.not_found',
        errorCode: ERROR_CODES.INTERVIEW_QUESTION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    question.isActive = !question.isActive;
    const saved = await this.uow.interviewQuestions.save(question);
    this.logger.log(
      `[${this.rid}] toggleActive — complete | questionId: ${questionId}, isActive: ${saved.isActive}`,
    );
    return this.toDto(saved);
  }

  private toDto(question: InterviewQuestion): InterviewQuestionBankResponseDto {
    return plainToInstance(
      InterviewQuestionBankResponseDto,
      {
        id: question.id,
        type: question.type,
        content: question.content,
        is_active: question.isActive,
        display_order: question.displayOrder ?? null,
        created_at: question.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
