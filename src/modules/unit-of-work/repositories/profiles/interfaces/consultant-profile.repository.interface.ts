import { AbstractRepository } from '@common/repositories';
import { ConsultantProfile } from '@database/entities';

export interface IConsultantProfileRepository extends AbstractRepository<ConsultantProfile> {
  findByUserId(userId: string): Promise<ConsultantProfile | null>;
}
