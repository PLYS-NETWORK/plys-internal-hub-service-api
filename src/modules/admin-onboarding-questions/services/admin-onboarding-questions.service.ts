import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { OnboardingQuestion } from '@database/entities';
import { OnboardingQuestionType } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  CreateOnboardingQuestionDto,
  ListInactiveOnboardingQuestionsDto,
  ReorderOnboardingQuestionsDto,
  UpdateOnboardingQuestionDto,
} from '../dto/requests';
import { OnboardingQuestionResponseDto } from '../dto/responses';
import { IAdminOnboardingQuestionsService } from '../interfaces/admin-onboarding-questions-service.interface';

@Injectable()
export class AdminOnboardingQuestionsService implements IAdminOnboardingQuestionsService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminOnboardingQuestionsService.name, requestContext);
  }

  /** @inheritdoc */
  public async create(dto: CreateOnboardingQuestionDto): Promise<OnboardingQuestionResponseDto> {
    this.logger.log(`[${this.rid}] create — start | type: ${dto.type}`);

    this.assertOptionsValid(dto.type, dto.options);

    const isActive = dto.isActive ?? true;

    const row = await this.uow.withTransaction(async (tx) => {
      const position = isActive ? (await tx.onboardingQuestions.findMaxActivePosition()) + 1 : null;
      const created = tx.onboardingQuestions.create({
        type: dto.type,
        question: dto.question,
        options: dto.type === OnboardingQuestionType.TEXT ? null : (dto.options ?? null),
        position,
        isActive,
      });
      return tx.onboardingQuestions.save(created);
    });

    this.logger.log(`[${this.rid}] create — complete | id: ${row.id} | position: ${row.position}`);
    return this.toResponseDto(row);
  }

  /** @inheritdoc */
  public async listActive(): Promise<OnboardingQuestionResponseDto[]> {
    this.logger.log(`[${this.rid}] listActive — start`);
    const rows = await this.uow.onboardingQuestions.findAllActiveOrdered();
    this.logger.log(`[${this.rid}] listActive — complete | count: ${rows.length}`);
    return rows.map((r) => this.toResponseDto(r));
  }

  /** @inheritdoc */
  public async listInactive(
    dto: ListInactiveOnboardingQuestionsDto,
  ): Promise<PageDto<OnboardingQuestionResponseDto>> {
    this.logger.log(`[${this.rid}] listInactive — start | page: ${dto.page} | limit: ${dto.limit}`);
    const { items, total } = await this.uow.onboardingQuestions.findInactivePaginated({
      skip: dto.skip,
      take: dto.limit,
    });
    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount: total });
    this.logger.log(`[${this.rid}] listInactive — complete | total: ${total}`);
    return new PageDto(
      items.map((r) => this.toResponseDto(r)),
      meta,
    );
  }

  /** @inheritdoc */
  public async getById(id: string): Promise<OnboardingQuestionResponseDto> {
    this.logger.log(`[${this.rid}] getById — start | id: ${id}`);
    const row = await this.uow.onboardingQuestions.findById(id);
    if (!row) {
      this.logger.warn(`[${this.rid}] getById — not found | id: ${id}`);
      throw this.notFound();
    }
    return this.toResponseDto(row);
  }

  /** @inheritdoc */
  public async update(
    id: string,
    dto: UpdateOnboardingQuestionDto,
  ): Promise<OnboardingQuestionResponseDto> {
    this.logger.log(`[${this.rid}] update — start | id: ${id}`);

    const updated = await this.uow.withTransaction(async (tx) => {
      const row = await tx.onboardingQuestions.findByActiveId(id);
      if (!row) throw this.notFound();

      if (dto.question !== undefined) {
        row.question = dto.question;
      }
      if (dto.options !== undefined) {
        if (row.type === OnboardingQuestionType.TEXT && dto.options.length > 0) {
          throw new TranslatableException({
            messageKey: 'error.onboarding_question.invalid_options',
            errorCode: ERROR_CODES.ONBOARDING_QUESTION_INVALID_OPTIONS,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }
        this.assertOptionsValid(row.type, dto.options);
        row.options = row.type === OnboardingQuestionType.TEXT ? null : dto.options;
      }

      return tx.onboardingQuestions.save(row);
    });

    this.logger.log(`[${this.rid}] update — complete | id: ${updated.id}`);
    return this.toResponseDto(updated);
  }

  /** @inheritdoc */
  public async setActive(id: string, value: boolean): Promise<OnboardingQuestionResponseDto> {
    this.logger.log(`[${this.rid}] setActive — start | id: ${id} | value: ${value}`);

    const updated = await this.uow.withTransaction(async (tx) => {
      const row = await tx.onboardingQuestions.findByActiveId(id);
      if (!row) throw this.notFound();
      if (row.isActive === value) {
        return row;
      }

      if (value) {
        row.position = (await tx.onboardingQuestions.findMaxActivePosition()) + 1;
        row.isActive = true;
        return tx.onboardingQuestions.save(row);
      }

      // Deactivating: detach (NULL out position) + compact remaining 1..N.
      row.isActive = false;
      row.position = null;
      const saved = await tx.onboardingQuestions.save(row);
      await tx.onboardingQuestions.detachAndCompact(id);
      return saved;
    });

    this.logger.log(`[${this.rid}] setActive — complete | id: ${id} | value: ${value}`);
    return this.toResponseDto(updated);
  }

  /** @inheritdoc */
  public async softDelete(id: string): Promise<void> {
    this.logger.log(`[${this.rid}] softDelete — start | id: ${id}`);

    await this.uow.withTransaction(async (tx) => {
      const row = await tx.onboardingQuestions.findByActiveId(id);
      if (!row) throw this.notFound();

      const wasActive = row.isActive;
      // Clear position first so the compaction sees a clean active set.
      row.position = null;
      row.isActive = false;
      await tx.onboardingQuestions.save(row);
      await tx.onboardingQuestions.softDelete(id);
      if (wasActive) {
        // Compaction across remaining active rows (the deactivated/deleted row is no longer in the active set).
        await tx.onboardingQuestions.detachAndCompact(id);
      }
    });

    this.logger.log(`[${this.rid}] softDelete — complete | id: ${id}`);
  }

  /** @inheritdoc */
  public async reorder(
    dto: ReorderOnboardingQuestionsDto,
  ): Promise<OnboardingQuestionResponseDto[]> {
    this.logger.log(`[${this.rid}] reorder — start | count: ${dto.orderedIds.length}`);

    const result = await this.uow.withTransaction(async (tx) => {
      const active = await tx.onboardingQuestions.findAllActiveOrdered();
      const activeIds = new Set(active.map((q) => q.id));
      const incomingIds = new Set(dto.orderedIds);

      const duplicates = dto.orderedIds.length !== incomingIds.size;
      const sizeMismatch = activeIds.size !== incomingIds.size;
      const coverageMismatch = !sizeMismatch && dto.orderedIds.some((id) => !activeIds.has(id));

      if (duplicates || sizeMismatch || coverageMismatch) {
        this.logger.warn(
          `[${this.rid}] reorder — set mismatch | active: ${activeIds.size} | incoming: ${incomingIds.size} | duplicates: ${duplicates} | coverage: ${coverageMismatch}`,
        );
        throw new TranslatableException({
          messageKey: 'error.onboarding_question.reorder_set_mismatch',
          errorCode: ERROR_CODES.ONBOARDING_REORDER_SET_MISMATCH,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }

      await tx.onboardingQuestions.reorderActive(dto.orderedIds);
      return tx.onboardingQuestions.findAllActiveOrdered();
    });

    this.logger.log(`[${this.rid}] reorder — complete | count: ${result.length}`);
    return result.map((r) => this.toResponseDto(r));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private notFound(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.onboarding_question.not_found',
      errorCode: ERROR_CODES.ONBOARDING_QUESTION_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private assertOptionsValid(
    type: OnboardingQuestionType,
    options: ReadonlyArray<{ value: string; label: string }> | null | undefined,
  ): void {
    if (type === OnboardingQuestionType.TEXT) {
      if (options && options.length > 0) {
        throw new TranslatableException({
          messageKey: 'error.onboarding_question.invalid_options',
          errorCode: ERROR_CODES.ONBOARDING_QUESTION_INVALID_OPTIONS,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
      return;
    }
    // RADIO / CHECKBOX
    if (!options || options.length < 2) {
      throw new TranslatableException({
        messageKey: 'error.onboarding_question.invalid_options',
        errorCode: ERROR_CODES.ONBOARDING_QUESTION_INVALID_OPTIONS,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
    const valueSet = new Set<string>();
    for (const o of options) {
      if (valueSet.has(o.value)) {
        throw new TranslatableException({
          messageKey: 'error.onboarding_question.invalid_options',
          errorCode: ERROR_CODES.ONBOARDING_QUESTION_INVALID_OPTIONS,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
      valueSet.add(o.value);
    }
  }

  private toResponseDto(row: OnboardingQuestion): OnboardingQuestionResponseDto {
    return plainToInstance(
      OnboardingQuestionResponseDto,
      {
        id: row.id,
        type: row.type,
        question: row.question,
        options: row.options ?? null,
        position: row.position ?? null,
        is_active: row.isActive,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
