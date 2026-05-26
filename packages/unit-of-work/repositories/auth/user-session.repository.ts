import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { UserSession } from '@plys/libraries/database/entities';
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
    // INNER JOIN is required here: PostgreSQL rejects FOR UPDATE with outer joins (0A000).
    // Every session row has a non-null FK to users (CASCADE DELETE removes orphans), so
    // INNER JOIN and LEFT JOIN are semantically equivalent — but only INNER is lock-safe.
    return this.createQueryBuilder('us')
      .innerJoinAndSelect('us.user', 'user')
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
