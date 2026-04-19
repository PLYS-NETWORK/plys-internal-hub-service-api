import { AbstractRepository } from '@common/repositories';
import { BusinessProfile } from '@database/entities';

export interface IBusinessProfileRepository extends AbstractRepository<BusinessProfile> {
  findByUserId(userId: string): Promise<BusinessProfile | null>;
}
