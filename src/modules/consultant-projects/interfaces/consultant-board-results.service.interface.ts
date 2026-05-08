import { CreateBoardResultDto, UpdateBoardResultDto } from '../dto/requests';
import { ConsultantBoardResultResponseDto } from '../dto/responses';

/**
 * Mutating side of the consultant kanban — create / update / delete the
 * task results the consultant authored. Reads live on the business surface
 * (`BoardResultsService.list`).
 */
export interface IConsultantBoardResultsService {
  /**
   * Create a result on a task assigned to the calling consultant.
   *
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 403 TASK_RESULT_NOT_ASSIGNEE.
   * @throws TranslatableException 400 TASK_RESULT_FILE_NOT_OWNED.
   */
  create(
    projectId: string,
    taskId: string,
    dto: CreateBoardResultDto,
  ): Promise<ConsultantBoardResultResponseDto>;

  /**
   * Update an existing result authored by the caller. Replaces remarks and
   * attachments atomically.
   *
   * @throws TranslatableException 404 TASK_RESULT_NOT_FOUND.
   * @throws TranslatableException 403 TASK_RESULT_FORBIDDEN.
   * @throws TranslatableException 400 TASK_RESULT_EMPTY_UPDATE.
   */
  update(
    projectId: string,
    taskId: string,
    resultId: string,
    dto: UpdateBoardResultDto,
  ): Promise<ConsultantBoardResultResponseDto>;

  /**
   * Soft-delete a result authored by the caller and orphan its attachments
   * for storage cleanup.
   *
   * @throws TranslatableException 404 TASK_RESULT_NOT_FOUND.
   * @throws TranslatableException 403 TASK_RESULT_FORBIDDEN.
   */
  delete(projectId: string, taskId: string, resultId: string): Promise<void>;
}
