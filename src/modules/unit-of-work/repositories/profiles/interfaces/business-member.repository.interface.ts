import { AbstractRepository } from '@common/repositories';
import { BusinessMember } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IBusinessMemberRepository extends AbstractRepository<BusinessMember> {}
