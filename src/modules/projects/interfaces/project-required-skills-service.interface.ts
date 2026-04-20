import { ProjectRequiredSkill } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

export interface IProjectRequiredSkillsService {
  findByProjectId(projectId: string, uow?: IUnitOfWork): Promise<ProjectRequiredSkill[]>;

  createForProject(
    projectId: string,
    skillIds: string[],
    uow: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]>;

  replaceForProject(
    projectId: string,
    skillIds: string[],
    uow: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]>;
}
