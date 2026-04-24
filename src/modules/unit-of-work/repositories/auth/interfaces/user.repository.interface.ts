import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';
import { ActivePlatform } from '@database/enums';

export interface IUserRepository extends AbstractRepository<User> {
  findUserByEmailAndPlatform(email: string, platform: ActivePlatform): Promise<User | null>;
}
