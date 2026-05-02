import { AbstractRepository } from '@common/repositories';
import { ProjectInterviewQuestion } from '@database/entities';

export interface IProjectInterviewQuestionRepository extends AbstractRepository<ProjectInterviewQuestion> {
  /**
   * Returns the number of distinct projects (within the given set) that have
   * at least one interview question configured.
   */
  countDistinctProjectIds(projectIds: string[]): Promise<number>;
}
