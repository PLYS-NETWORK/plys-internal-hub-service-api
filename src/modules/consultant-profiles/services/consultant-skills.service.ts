import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantSkill } from '@database/entities';
import { ProficiencyLevel } from '@database/enums/proficiency-level.enum';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, Logger } from '@nestjs/common';

import { ConsultantSkillInputDto } from '../dto/requests';
import { IConsultantSkillsService } from '../interfaces/consultant-skills-service.interface';

@Injectable()
export class ConsultantSkillsService implements IConsultantSkillsService {
  private readonly logger = new Logger(ConsultantSkillsService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async findByConsultantId(
    consultantId: string,
    uow?: IUnitOfWork,
  ): Promise<ConsultantSkill[]> {
    return (uow ?? this.uow).consultantSkills.findByConsultantId(consultantId);
  }

  public async createForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]> {
    if (skills.length === 0) return [];

    this.logger.log(
      `[${this.rid}] createForConsultant — start | consultantId: ${consultantId}, count: ${skills.length}`,
    );

    const entities = skills.map((s) =>
      uow.consultantSkills.create({
        consultantId,
        skillId: s.skill_id,
        proficiencyLevel:
          (s.proficiency_level as ProficiencyLevel) ?? ProficiencyLevel.INTERMEDIATE,
        yearsWithSkill: s.years_with_skill ?? null,
      }),
    );
    const saved = (await uow.consultantSkills.save(entities)) as ConsultantSkill[];

    this.logger.log(
      `[${this.rid}] createForConsultant — complete | consultantId: ${consultantId}, inserted: ${saved.length}`,
    );
    return saved;
  }

  public async replaceForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]> {
    this.logger.log(
      `[${this.rid}] replaceForConsultant — start | consultantId: ${consultantId}, count: ${skills.length}`,
    );

    await uow.consultantSkills.delete({ consultantId });
    const result = await this.createForConsultant(consultantId, skills, uow);

    this.logger.log(
      `[${this.rid}] replaceForConsultant — complete | consultantId: ${consultantId}, inserted: ${result.length}`,
    );
    return result;
  }
}
