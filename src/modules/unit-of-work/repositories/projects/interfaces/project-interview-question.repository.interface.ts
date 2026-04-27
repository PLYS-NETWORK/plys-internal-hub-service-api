import { AbstractRepository } from '@common/repositories';
import { ProjectInterviewQuestion } from '@database/entities';

export interface IInterviewQuestionWithAnswerCount {
  id: string;
  /** Display order; 1-indexed in the response. */
  position: number;
  question_text: string;
  /** Distinct applicants who submitted an answer to this question. */
  answer_count: number;
}

export interface IProjectInterviewQuestionRepository extends AbstractRepository<ProjectInterviewQuestion> {
  /**
   * Returns the number of distinct projects (within the given set) that have
   * at least one interview question configured.
   */
  countDistinctProjectIds(projectIds: string[]): Promise<number>;

  /**
   * Returns the count of `is_required = true` questions per project.
   * Projects with zero required questions are absent from the map.
   */
  countRequiredByProjectIds(projectIds: string[]): Promise<Map<string, number>>;

  /**
   * Returns each interview question for a project together with the count of
   * distinct applicants who answered it. Sorted by `display_order` ascending.
   * Powers the project-overview interview-question stats card.
   */
  findWithAnswerCountsByProjectId(projectId: string): Promise<IInterviewQuestionWithAnswerCount[]>;
}
