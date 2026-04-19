import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IUserRepository } from './interfaces';

@Injectable()
export class UserRepository extends AbstractRepository<User> implements IUserRepository {
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(User, manager);
  }

  public withManager(manager: EntityManager): this {
    return new UserRepository(manager) as this;
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    return this.createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).getOne();
  }
}
