import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantSkill } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { ConsultantSkillInputDto } from './dto/requests';
import { IConsultantSkillsService } from './interfaces/consultant-skills-service.interface';

@Injectable()
export class ConsultantSkillsService implements IConsultantSkillsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantSkillsService.name, requestContext);
  }

  /** @inheritdoc */
  public async findByConsultantId(
    consultantId: string,
    uow?: IUnitOfWork,
  ): Promise<ConsultantSkill[]> {
    return (uow ?? this.uow).consultantSkills.findByConsultantId(consultantId);
  }

  /** @inheritdoc */
  public async createForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]> {
    if (skills.length === 0) return [];

    this.logger.log(
      `createForConsultant — start | consultantId: ${consultantId}, count: ${skills.length}`,
    );

    // NOTE: post-refactor, proficiencyLevel + rating are assigned by the skill-exam
    // pipeline (not user-supplied). The legacy `s.proficiency_level` is ignored.
    const entities = skills.map((s) =>
      uow.consultantSkills.create({
        consultantId,
        skillId: s.skill_id,
        proficiencyLevel: null,
        rating: null,
      }),
    );
    const saved = (await uow.consultantSkills.save(entities)) as ConsultantSkill[];

    this.logger.log(
      `createForConsultant — complete | consultantId: ${consultantId}, inserted: ${saved.length}`,
    );
    return saved;
  }

  /** @inheritdoc */
  public async replaceForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]> {
    this.logger.log(
      `replaceForConsultant — start | consultantId: ${consultantId}, count: ${skills.length}`,
    );

    await uow.consultantSkills.delete({ consultantId });
    const result = await this.createForConsultant(consultantId, skills, uow);

    this.logger.log(
      `replaceForConsultant — complete | consultantId: ${consultantId}, inserted: ${result.length}`,
    );
    return result;
  }
}
