import { AbstractRepository } from '@common/repositories';
import { ProjectRequiredSkill } from '@database/entities';

export interface IProjectRequiredSkillRepository extends AbstractRepository<ProjectRequiredSkill> {
  /**
   * Returns the bare `skill_id` set for a single project. Used by the
   * project-overview team block to flag each consultant's skills as
   * `is_required: true` when they intersect with the project's requirement list.
   */
  findSkillIdsByProjectId(projectId: string): Promise<string[]>;

  /**
   * Returns every required-skill row for a project with the `skill` relation
   * eagerly populated. Used by read-only callers (e.g. the public explore
   * detail endpoint) that need the full Skill row, not just the id.
   */
  findWithSkillByProjectId(projectId: string): Promise<ProjectRequiredSkill[]>;
}
