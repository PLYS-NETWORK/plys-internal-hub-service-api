import { AbstractRepository } from '@common/repositories';
import { ConsultantApplicationAnswer } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantApplicationAnswerRepository } from './interfaces';

@Injectable()
export class ConsultantApplicationAnswerRepository
  extends AbstractRepository<ConsultantApplicationAnswer>
  implements IConsultantApplicationAnswerRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantApplicationAnswer, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantApplicationAnswerRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findByApplicationId(applicationId: string): Promise<ConsultantApplicationAnswer[]> {
    return this.createQueryBuilder('aa')
      .innerJoinAndSelect('aa.applicationQuestion', 'aq')
      .where('aq.application_id = :applicationId', { applicationId })
      .orderBy('aq.question_order', 'ASC')
      .getMany();
  }

  /** @inheritdoc */
  public async countByApplicationId(applicationId: string): Promise<number> {
    return this.createQueryBuilder('aa')
      .innerJoin('aa.applicationQuestion', 'aq')
      .where('aq.application_id = :applicationId', { applicationId })
      .getCount();
  }
}
