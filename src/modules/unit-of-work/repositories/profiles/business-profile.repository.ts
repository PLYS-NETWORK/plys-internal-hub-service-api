import { AbstractRepository } from '@common/repositories';
import { BusinessProfile } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IBusinessProfileRepository, IExistsTaxIdConflictParams } from './interfaces';

@Injectable()
export class BusinessProfileRepository
  extends AbstractRepository<BusinessProfile>
  implements IBusinessProfileRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(BusinessProfile, manager);
  }

  public withManager(manager: EntityManager): this {
    return new BusinessProfileRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findByUserId(userId: string): Promise<BusinessProfile | null> {
    return this.findOne({ where: { userId } });
  }

  /** @inheritdoc */
  public async findByIdForUpdate(id: string): Promise<BusinessProfile | null> {
    return this.createQueryBuilder('bp')
      .where('bp.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
  }

  /** @inheritdoc */
  public async findOneByUserAndId(
    userId: string,
    businessId: string,
  ): Promise<BusinessProfile | null> {
    return this.findOne({ where: { id: businessId, userId } });
  }

  /** @inheritdoc */
  public async existsTaxIdConflict(params: IExistsTaxIdConflictParams): Promise<boolean> {
    const qb = this.createQueryBuilder('bp')
      .innerJoin('bp.user', 'u')
      .where('bp.tax_id = :taxId', { taxId: params.taxId })
      .andWhere('bp.country_code = :country', { country: params.countryCode })
      .andWhere('bp.deleted_at IS NULL')
      .andWhere('u.platform = :platform', { platform: params.platform })
      .andWhere('u.is_active = TRUE')
      .andWhere('u.banned_at IS NULL');

    if (params.excludeUserId) {
      qb.andWhere('u.id != :excludeUserId', { excludeUserId: params.excludeUserId });
    }

    const conflict = await qb.getExists();
    return conflict;
  }
}
