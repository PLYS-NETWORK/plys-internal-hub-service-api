import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IUserRepository extends AbstractRepository<User> {}
