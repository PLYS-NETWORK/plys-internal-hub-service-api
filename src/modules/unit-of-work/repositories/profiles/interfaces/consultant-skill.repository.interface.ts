import { AbstractRepository } from '@common/repositories';
import { ConsultantSkill } from '@database/entities';

export interface IConsultantSkillRepository extends AbstractRepository<ConsultantSkill> {
  findByConsultantId(consultantId: string): Promise<ConsultantSkill[]>;
}
