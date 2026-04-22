import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectRequiredSkill } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { IProjectRequiredSkillsService } from '../interfaces';

@Injectable()
export class ProjectRequiredSkillsService implements IProjectRequiredSkillsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ProjectRequiredSkillsService.name, requestContext);
  }

  public async findByProjectId(
    projectId: string,
    uow?: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]> {
    return (uow ?? this.uow).projectRequiredSkills.find({
      where: { projectId },
      relations: { skill: true },
    });
  }

  public async createForProject(
    projectId: string,
    skillIds: string[],
    uow: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]> {
    if (skillIds.length === 0) return [];

    this.logger.log(
      `createForProject — start | projectId: ${projectId}, count: ${skillIds.length}`,
    );

    const entities = skillIds.map((skillId) =>
      uow.projectRequiredSkills.create({ projectId, skillId }),
    );
    await uow.projectRequiredSkills.save(entities);

    // Re-fetch with the skill relation so callers receive translated-ready records.
    const saved = await uow.projectRequiredSkills.find({
      where: { projectId },
      relations: { skill: true },
    });

    this.logger.log(
      `createForProject — complete | projectId: ${projectId}, inserted: ${saved.length}`,
    );
    return saved;
  }

  public async replaceForProject(
    projectId: string,
    skillIds: string[],
    uow: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]> {
    this.logger.log(
      `replaceForProject — start | projectId: ${projectId}, count: ${skillIds.length}`,
    );

    await uow.projectRequiredSkills.delete({ projectId });
    const result = await this.createForProject(projectId, skillIds, uow);

    this.logger.log(
      `replaceForProject — complete | projectId: ${projectId}, inserted: ${result.length}`,
    );
    return result;
  }
}
