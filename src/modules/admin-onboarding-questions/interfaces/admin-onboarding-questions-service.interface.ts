import { PageDto } from '@common/dto/page.dto';

import {
  CreateOnboardingQuestionDto,
  ListInactiveOnboardingQuestionsDto,
  ReorderOnboardingQuestionsDto,
  UpdateOnboardingQuestionDto,
} from '../dto/requests';
import { OnboardingQuestionResponseDto } from '../dto/responses';

export interface IAdminOnboardingQuestionsService {
  /**
   * Creates a new onboarding question. When `is_active=true` (default) the question
   * is appended at the end of the active set (position = max(active)+1).
   * @throws HttpStatus.UNPROCESSABLE_ENTITY (`ONBOARDING_QUESTION_INVALID_OPTIONS`)
   *   when options shape does not match the chosen type.
   */
  create(dto: CreateOnboardingQuestionDto): Promise<OnboardingQuestionResponseDto>;

  /**
   * Returns all active, non-soft-deleted questions ordered by position ASC.
   * No pagination — the active set is bounded to whatever admin curates.
   */
  listActive(): Promise<OnboardingQuestionResponseDto[]>;

  /**
   * Returns paginated inactive (is_active=false), non-soft-deleted questions
   * sorted by most-recently updated.
   */
  listInactive(
    dto: ListInactiveOnboardingQuestionsDto,
  ): Promise<PageDto<OnboardingQuestionResponseDto>>;

  /**
   * Returns the single question (including soft-deleted, for admin audit).
   * @throws HttpStatus.NOT_FOUND (`ONBOARDING_QUESTION_NOT_FOUND`)
   */
  getById(id: string): Promise<OnboardingQuestionResponseDto>;

  /**
   * Updates question text and/or options. Type cannot be changed.
   * @throws HttpStatus.NOT_FOUND or HttpStatus.UNPROCESSABLE_ENTITY
   */
  update(id: string, dto: UpdateOnboardingQuestionDto): Promise<OnboardingQuestionResponseDto>;

  /**
   * Bidirectional toggle. Activating assigns next-free position; deactivating
   * clears position and compacts the remaining active positions to 1..N.
   * @throws HttpStatus.NOT_FOUND
   */
  setActive(id: string, value: boolean): Promise<OnboardingQuestionResponseDto>;

  /**
   * Soft-deletes the question. If it was active, compacts remaining active positions.
   * @throws HttpStatus.NOT_FOUND
   */
  softDelete(id: string): Promise<void>;

  /**
   * Bulk reorder. The orderedIds set MUST equal the full current active set.
   * @throws HttpStatus.UNPROCESSABLE_ENTITY (`ONBOARDING_REORDER_SET_MISMATCH`)
   *   when ordered_ids contain duplicates, inactive ids, or do not cover all active ids.
   */
  reorder(dto: ReorderOnboardingQuestionsDto): Promise<OnboardingQuestionResponseDto[]>;
}
