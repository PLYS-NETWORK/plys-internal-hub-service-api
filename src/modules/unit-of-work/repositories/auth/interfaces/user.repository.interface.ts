import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';

export interface IUserRepository extends AbstractRepository<User> {
  findUserByEmail(email: string): Promise<User | null>;
}
