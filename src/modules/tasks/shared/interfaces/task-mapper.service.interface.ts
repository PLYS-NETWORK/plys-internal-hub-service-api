import {
  Task,
  TaskComment,
  TaskEvidence,
  TaskEvidenceAttachment,
  TaskHistory,
} from '@database/entities';

import {
  ConsultantTaskResponseDto,
  TaskCommentResponseDto,
  TaskEvidenceAttachmentResponseDto,
  TaskEvidenceResponseDto,
  TaskHistoryResponseDto,
  TaskResponseDto,
} from '../../dto/responses';

/**
 * Centralized entity → response DTO conversion for the tasks module.
 *
 * Every controller-facing response should go through this service so that
 * snake_case key mapping, `excludeExtraneousValues`, and field selection live
 * in one place. Adding a new field to a response DTO requires only an edit
 * here and in the DTO class itself.
 */
export interface ITaskMapperService {
  /**
   * Map a `Task` entity to the full business-facing `TaskResponseDto`
   * (includes pricing fields).
   */
  toTaskResponseDto(task: Task): TaskResponseDto;

  /**
   * Map a `Task` entity to the consultant-facing `ConsultantTaskResponseDto`
   * (omits price, platform_fee_amount, consultant_payout).
   */
  toConsultantTaskResponseDto(task: Task): ConsultantTaskResponseDto;

  /**
   * Map a `TaskHistory` audit row to its response DTO.
   */
  toTaskHistoryResponseDto(history: TaskHistory): TaskHistoryResponseDto;

  /**
   * Map a `TaskComment` entity to its response DTO.
   */
  toTaskCommentResponseDto(comment: TaskComment): TaskCommentResponseDto;

  /**
   * Map a `TaskEvidence` entity (plus its attachments) to the response DTO.
   * The attachments list is supplied separately because the service composes it
   * either from a relation load or a fresh repository query depending on the
   * call site.
   */
  toTaskEvidenceResponseDto(
    evidence: TaskEvidence,
    attachments: TaskEvidenceAttachment[],
  ): TaskEvidenceResponseDto;

  /**
   * Map a single `TaskEvidenceAttachment` to its response DTO.
   */
  toTaskEvidenceAttachmentResponseDto(
    attachment: TaskEvidenceAttachment,
  ): TaskEvidenceAttachmentResponseDto;
}
