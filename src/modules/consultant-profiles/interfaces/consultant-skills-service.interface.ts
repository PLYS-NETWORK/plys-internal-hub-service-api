import { ConsultantSkill } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

import { ConsultantSkillInputDto } from '../dto/requests';

export interface IConsultantSkillsService {
  findByConsultantId(consultantId: string, uow?: IUnitOfWork): Promise<ConsultantSkill[]>;
  createForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]>;
  replaceForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]>;
}
