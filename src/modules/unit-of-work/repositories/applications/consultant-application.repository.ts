import { AbstractRepository } from '@common/repositories';
import { ConsultantApplication } from '@database/entities';
import { ApplicationStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantApplicationRepository } from './interfaces';

const TERMINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.COPYLEAKS_FAILED,
];

@Injectable()
export class ConsultantApplicationRepository
  extends AbstractRepository<ConsultantApplication>
  implements IConsultantApplicationRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantApplication, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantApplicationRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findLatestByUserId(userId: string): Promise<ConsultantApplication | null> {
    return this.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** @inheritdoc */
  public async findActiveByUserId(userId: string): Promise<ConsultantApplication | null> {
    return this.createQueryBuilder('ca')
      .where('ca.user_id = :userId', { userId })
      .andWhere('ca.status NOT IN (:...terminalStatuses)', {
        terminalStatuses: TERMINAL_STATUSES,
      })
      .andWhere('ca.deleted_at IS NULL')
      .orderBy('ca.created_at', 'DESC')
      .getOne();
  }

  /** @inheritdoc */
  public async findManyWithFilters(filters: {
    status?: ApplicationStatus;
    keyword?: string;
    page: number;
    take: number;
  }): Promise<[ConsultantApplication[], number]> {
    const qb = this.createQueryBuilder('ca')
      .leftJoinAndSelect('ca.user', 'u')
      .andWhere('ca.deleted_at IS NULL')
      .orderBy('ca.created_at', 'DESC')
      .skip((filters.page - 1) * filters.take)
      .take(filters.take);

    if (filters.status) {
      qb.andWhere('ca.status = :status', { status: filters.status });
    }

    if (filters.keyword) {
      qb.andWhere('LOWER(u.email) LIKE :keyword', {
        keyword: `%${filters.keyword.toLowerCase()}%`,
      });
    }

    return qb.getManyAndCount();
  }
}
