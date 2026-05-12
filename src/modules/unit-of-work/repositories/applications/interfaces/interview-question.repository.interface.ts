import { AbstractRepository } from '@common/repositories';
import { InterviewQuestion } from '@database/entities';
import { QuestionType } from '@database/enums';

export interface IInterviewQuestionRepository extends AbstractRepository<InterviewQuestion> {
  /**
   * Returns N random active questions of the given type from the seed bank.
   * @param type Question type filter.
   * @param limit Number of rows to return.
   */
  findRandomActiveByType(type: QuestionType, limit: number): Promise<InterviewQuestion[]>;
}
