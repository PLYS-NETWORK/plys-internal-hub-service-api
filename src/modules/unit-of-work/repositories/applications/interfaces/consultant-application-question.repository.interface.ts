import { AbstractRepository } from '@common/repositories';
import { ConsultantApplicationQuestion } from '@database/entities';
import { QuestionType } from '@database/enums';

export interface IConsultantApplicationQuestionRepository extends AbstractRepository<ConsultantApplicationQuestion> {
  /**
   * Returns all questions assigned to an application, ordered by questionOrder.
   *
   * @param applicationId - The application's UUID.
   * @returns Ordered array of ConsultantApplicationQuestion rows.
   */
  findByApplicationId(applicationId: string): Promise<ConsultantApplicationQuestion[]>;

  /**
   * Returns questions of a specific type for an application, ordered by questionOrder.
   *
   * @param applicationId - The application's UUID.
   * @param type - The question type to filter by.
   * @returns Filtered and ordered array of ConsultantApplicationQuestion rows.
   */
  findByApplicationIdAndType(
    applicationId: string,
    type: QuestionType,
  ): Promise<ConsultantApplicationQuestion[]>;
}
