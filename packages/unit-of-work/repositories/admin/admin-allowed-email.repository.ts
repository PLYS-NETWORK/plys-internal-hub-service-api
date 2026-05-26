import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { AdminAllowedEmail } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IAdminAllowedEmailRepository } from './interfaces';

@Injectable()
export class AdminAllowedEmailRepository
  extends AbstractRepository<AdminAllowedEmail>
  implements IAdminAllowedEmailRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(AdminAllowedEmail, manager);
  }

  public withManager(manager: EntityManager): this {
    return new AdminAllowedEmailRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findActiveByEmail(email: string): Promise<AdminAllowedEmail | null> {
    return this.createQueryBuilder('ae')
      .where('LOWER(ae.email) = LOWER(:email)', { email })
      .andWhere('ae.is_active = true')
      .getOne();
  }

  /** @inheritdoc */
  public async findByEmail(email: string): Promise<AdminAllowedEmail | null> {
    return this.createQueryBuilder('ae')
      .where('LOWER(ae.email) = LOWER(:email)', { email })
      .getOne();
  }
}
