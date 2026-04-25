import { ProjectInterviewQuestion } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

import { InterviewQuestionItemDto } from '../dto/requests/interview-question-item.dto';

export interface IProjectInterviewQuestionsService {
  /**
   * Retrieves all interview questions linked to the given project.
   *
   * @param projectId - UUID of the project whose interview questions are fetched.
   * @param uow       - Optional Unit of Work; uses default connection when omitted.
   * @returns Array of ProjectInterviewQuestion entities ordered by `display_order`; empty array if none exist.
   */
  findByProjectId(projectId: string, uow?: IUnitOfWork): Promise<ProjectInterviewQuestion[]>;

  /**
   * Inserts a new set of interview questions for the project within the provided transaction.
   *
   * @param projectId - UUID of the project to attach questions to.
   * @param items     - Ordered list of interview question payloads to insert.
   * @param uow       - Active Unit of Work — caller must supply an open transaction.
   * @returns Array of the newly created ProjectInterviewQuestion entities.
   */
  createForProject(
    projectId: string,
    items: InterviewQuestionItemDto[],
    uow: IUnitOfWork,
  ): Promise<ProjectInterviewQuestion[]>;

  /**
   * Deletes all existing interview questions for the project and inserts the new set atomically.
   *
   * Use this when the client sends a full replacement of the question list (e.g., on
   * project update). Both operations share the same transaction as the caller.
   *
   * @param projectId - UUID of the project whose interview questions are replaced.
   * @param items     - New ordered list of question payloads; may be empty to clear all questions.
   * @param uow       - Active Unit of Work — caller must supply an open transaction.
   * @returns Array of the newly created ProjectInterviewQuestion entities after replacement.
   */
  replaceForProject(
    projectId: string,
    items: InterviewQuestionItemDto[],
    uow: IUnitOfWork,
  ): Promise<ProjectInterviewQuestion[]>;
}
