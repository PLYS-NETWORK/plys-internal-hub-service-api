import {
  UpdateInterviewQuestionDto,
  UpdateProjectSettingsDto,
  UpsertInterviewQuestionDto,
} from '../dto/requests';
import {
  InterviewQuestionResponseDto,
  ProjectSettingsResponseDto,
  ProjectSummaryResponseDto,
} from '../dto/responses';

/**
 * Project metadata + interview-question CRUD. Disallowed once the project
 * reaches a terminal state (DONE, CANCELLED).
 */
export interface ISettingsService {
  /**
   * Returns the current settings shape used by the edit screen — the same
   * fields the PATCH/POST/DELETE methods write to. Interview questions are
   * filtered to active rows only (soft-deleted ones are excluded).
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   */
  getSettings(projectId: string): Promise<ProjectSettingsResponseDto>;

  /** Updates editable project fields. `required_skills` replaces the full set when present. */
  updateProject(
    projectId: string,
    dto: UpdateProjectSettingsDto,
  ): Promise<ProjectSummaryResponseDto>;

  /** Creates a new interview question. */
  createQuestion(
    projectId: string,
    dto: UpsertInterviewQuestionDto,
  ): Promise<InterviewQuestionResponseDto>;

  /** Patch-update an existing question. */
  updateQuestion(
    projectId: string,
    questionId: string,
    dto: UpdateInterviewQuestionDto,
  ): Promise<InterviewQuestionResponseDto>;

  /**
   * Soft-deletes a question. Old applications keep referencing the row so the
   * `interview_answers` audit trail stays readable on the application detail
   * screen.
   */
  deleteQuestion(projectId: string, questionId: string): Promise<void>;
}
