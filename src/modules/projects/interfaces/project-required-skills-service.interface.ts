import { ProjectRequiredSkill } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

export interface IProjectRequiredSkillsService {
  /**
   * Retrieves all required skills linked to the given project.
   *
   * @param projectId - UUID of the project whose required skills are fetched.
   * @param uow       - Optional Unit of Work; uses default connection when omitted.
   * @returns Array of ProjectRequiredSkill entities; empty array if none exist.
   */
  findByProjectId(projectId: string, uow?: IUnitOfWork): Promise<ProjectRequiredSkill[]>;

  /**
   * Creates required-skill associations for the given project within the provided transaction.
   *
   * @param projectId - UUID of the project to link skills to.
   * @param skillIds  - List of Skill UUIDs to associate with the project.
   * @param uow       - Active Unit of Work — caller must supply an open transaction.
   * @returns Array of the newly created ProjectRequiredSkill entities.
   */
  createForProject(
    projectId: string,
    skillIds: string[],
    uow: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]>;

  /**
   * Removes all existing required-skill associations and inserts the new set atomically.
   *
   * Use this when the client sends a full replacement of the skill list (e.g., on
   * project update). Both operations share the same transaction as the caller.
   *
   * @param projectId - UUID of the project whose required skills are replaced.
   * @param skillIds  - New list of Skill UUIDs; may be empty to clear all skills.
   * @param uow       - Active Unit of Work — caller must supply an open transaction.
   * @returns Array of the newly created ProjectRequiredSkill entities after replacement.
   */
  replaceForProject(
    projectId: string,
    skillIds: string[],
    uow: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]>;
}
