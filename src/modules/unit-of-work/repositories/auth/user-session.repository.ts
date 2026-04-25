import { AbstractRepository } from '@common/repositories';
import { UserSession } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IUserSessionRepository } from './interfaces';

@Injectable()
export class UserSessionRepository
  extends AbstractRepository<UserSession>
  implements IUserSessionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(UserSession, manager);
  }

  public withManager(manager: EntityManager): this {
    return new UserSessionRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findActiveByTokenForUpdate(tokenHash: string): Promise<UserSession | null> {
    return this.createQueryBuilder('us')
      .leftJoinAndSelect('us.user', 'user')
      .where('us.session_token = :tokenHash', { tokenHash })
      .andWhere('us.used_at IS NULL')
      .setLock('pessimistic_write')
      .getOne();
  }

  /** @inheritdoc */
  public async findByToken(tokenHash: string): Promise<UserSession | null> {
    return this.findOne({
      where: { sessionToken: tokenHash },
      relations: ['user'],
    });
  }
}
