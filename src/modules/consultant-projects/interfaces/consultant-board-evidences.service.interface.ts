import { CreateBoardEvidenceDto, UpdateBoardEvidenceDto } from '../dto/requests';
import { ConsultantBoardEvidenceResponseDto } from '../dto/responses';

export interface IConsultantBoardEvidencesService {
  /**
   * Creates a piece of work-evidence authored by the calling consultant on a
   * task they are currently assigned to. Up to 10 file attachments may be
   * supplied; each must be owned by the caller.
   *
   * @throws TranslatableException 404 TASK_NOT_FOUND / 403 PROJECT_FORBIDDEN.
   * @throws TranslatableException 403 TASK_EVIDENCE_NOT_ASSIGNEE — caller is not the task assignee.
   * @throws TranslatableException 400 TASK_EVIDENCE_FILE_NOT_OWNED.
   */
  create(
    projectId: string,
    taskId: string,
    dto: CreateBoardEvidenceDto,
  ): Promise<ConsultantBoardEvidenceResponseDto>;

  /**
   * Updates an own evidence (assignee + author). Replaces attachments
   * wholesale when `file_ids` is provided. Optimistic-lock via
   * `@VersionColumn` on `task_evidences`.
   *
   * @throws TranslatableException 400 TASK_EVIDENCE_EMPTY_UPDATE.
   * @throws TranslatableException 404 TASK_EVIDENCE_NOT_FOUND.
   * @throws TranslatableException 403 TASK_EVIDENCE_FORBIDDEN.
   */
  update(
    projectId: string,
    taskId: string,
    evidenceId: string,
    dto: UpdateBoardEvidenceDto,
  ): Promise<ConsultantBoardEvidenceResponseDto>;

  /**
   * Soft-deletes own evidence and detaches its attachments.
   *
   * @throws TranslatableException 404 TASK_EVIDENCE_NOT_FOUND.
   * @throws TranslatableException 403 TASK_EVIDENCE_FORBIDDEN.
   */
  delete(projectId: string, taskId: string, evidenceId: string): Promise<void>;
}
