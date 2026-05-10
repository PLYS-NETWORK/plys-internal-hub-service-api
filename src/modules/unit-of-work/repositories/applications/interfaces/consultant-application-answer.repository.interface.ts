import { AbstractRepository } from '@common/repositories';
import { ConsultantApplicationAnswer } from '@database/entities';

export interface IConsultantApplicationAnswerRepository extends AbstractRepository<ConsultantApplicationAnswer> {
  /**
   * Returns all answers for a given application by joining through the question records.
   *
   * @param applicationId - The application's UUID.
   * @returns Array of ConsultantApplicationAnswer rows with their associated questions.
   */
  findByApplicationId(applicationId: string): Promise<ConsultantApplicationAnswer[]>;

  /**
   * Counts the number of submitted answers for an application.
   *
   * @param applicationId - The application's UUID.
   * @returns Total count of answer rows for the application.
   */
  countByApplicationId(applicationId: string): Promise<number>;
}
