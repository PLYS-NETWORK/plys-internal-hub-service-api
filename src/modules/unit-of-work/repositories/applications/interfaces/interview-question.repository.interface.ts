import { AbstractRepository } from '@common/repositories';
import { InterviewQuestion } from '@database/entities';
import { QuestionType } from '@database/enums';

export interface IInterviewQuestionRepository extends AbstractRepository<InterviewQuestion> {
  /**
   * Finds all active questions of a given type, ordered by displayOrder.
   *
   * @param type - The question type to filter by.
   * @returns Array of active InterviewQuestion rows in display order.
   */
  findActiveByType(type: QuestionType): Promise<InterviewQuestion[]>;
}
