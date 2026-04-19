import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';
import { ActivePlatform } from '@database/enums/active-platform.enum';
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

  public async findUserByEmailAndPlatform(
    email: string,
    platform: ActivePlatform,
  ): Promise<User | null> {
    return this.createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .andWhere('u.platform = :platform', { platform })
      .getOne();
  }
}
