import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';
import { ActivePlatform, UserRole } from '@database/enums';
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

  /** @inheritdoc */
  public async findActiveAdminUserIds(): Promise<string[]> {
    const rows = await this.createQueryBuilder('u')
      .select('u.id')
      .where('u.role = :role', { role: UserRole.ADMIN_PLATFORM })
      .andWhere('u.is_active = true')
      .getRawMany<{ u_id: string }>();
    return rows.map((r) => r.u_id);
  }
}
