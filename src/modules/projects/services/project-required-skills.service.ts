import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectRequiredSkill } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ProjectRequiredSkillsService {
  private readonly logger = new Logger(ProjectRequiredSkillsService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

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
      `[${this.rid}] createForProject — start | projectId: ${projectId}, count: ${skillIds.length}`,
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
      `[${this.rid}] createForProject — complete | projectId: ${projectId}, inserted: ${saved.length}`,
    );
    return saved;
  }

  public async replaceForProject(
    projectId: string,
    skillIds: string[],
    uow: IUnitOfWork,
  ): Promise<ProjectRequiredSkill[]> {
    this.logger.log(
      `[${this.rid}] replaceForProject — start | projectId: ${projectId}, count: ${skillIds.length}`,
    );

    await uow.projectRequiredSkills.delete({ projectId });
    const result = await this.createForProject(projectId, skillIds, uow);

    this.logger.log(
      `[${this.rid}] replaceForProject — complete | projectId: ${projectId}, inserted: ${result.length}`,
    );
    return result;
  }
}
