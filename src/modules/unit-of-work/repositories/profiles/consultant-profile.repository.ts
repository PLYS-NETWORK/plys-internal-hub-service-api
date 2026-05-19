import { AbstractRepository } from '@common/repositories';
import { ConsultantProfile } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantProfileRepository } from './interfaces';

@Injectable()
export class ConsultantProfileRepository
  extends AbstractRepository<ConsultantProfile>
  implements IConsultantProfileRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantProfile, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantProfileRepository(manager) as this;
  }

  public async findByUserId(userId: string): Promise<ConsultantProfile | null> {
    return this.findOne({ where: { userId } });
  }

  /** @inheritdoc */
  public async findUserIdsBySkillIds(
    skillIds: string[],
    offset: number,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.createQueryBuilder('cp')
      .select('DISTINCT cp.user_id', 'userId')
      .innerJoin('consultant_skills', 'cs', 'cs.consultant_id = cp.id')
      .where('cs.skill_id IN (:...skillIds)', { skillIds })
      .offset(offset)
      .limit(limit)
      .getRawMany<{ userId: string }>();
    return rows.map((r) => r.userId);
  }

  /** @inheritdoc */
  public async sumAccountBalances(): Promise<string> {
    const row = await this.createQueryBuilder('cp')
      .select('COALESCE(SUM(cp.account_balance), 0)', 'amount')
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async incrementAccountBalance(consultantId: string, amount: string): Promise<void> {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`incrementAccountBalance: invalid amount ${amount}`);
    }
    const result = await this.createQueryBuilder()
      .update()
      .set({ accountBalance: () => `"account_balance" + ${numeric}` })
      .where('id = :consultantId', { consultantId })
      .execute();
    if ((result.affected ?? 0) === 0) {
      throw new Error(`incrementAccountBalance: consultant_profile ${consultantId} not found`);
    }
  }
}
