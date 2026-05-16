import { AbstractRepository } from '@common/repositories';
import { ProjectRequiredSkill } from '@database/entities';

export interface IProjectRequiredSkillRepository extends AbstractRepository<ProjectRequiredSkill> {
  /**
   * Returns the bare `skill_id` set for a single project. Used by the
   * project-overview team block to flag each consultant's skills as
   * `is_required: true` when they intersect with the project's requirement list.
   */
  findSkillIdsByProjectId(projectId: string): Promise<string[]>;
}
