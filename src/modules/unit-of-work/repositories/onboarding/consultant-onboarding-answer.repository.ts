import { AbstractRepository } from '@common/repositories';
import { ConsultantOnboardingAnswer } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantOnboardingAnswerRepository } from './interfaces';

@Injectable()
export class ConsultantOnboardingAnswerRepository
  extends AbstractRepository<ConsultantOnboardingAnswer>
  implements IConsultantOnboardingAnswerRepository
{
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(ConsultantOnboardingAnswer, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantOnboardingAnswerRepository(manager) as this;
  }

  public async findByOnboardingId(onboardingId: string): Promise<ConsultantOnboardingAnswer[]> {
    return this.repository.find({
      where: { onboardingId },
      order: { submittedAt: 'ASC' },
    });
  }
}
