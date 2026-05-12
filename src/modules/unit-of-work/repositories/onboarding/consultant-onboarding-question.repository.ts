import { AbstractRepository } from '@common/repositories';
import { ConsultantOnboardingQuestion } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantOnboardingQuestionRepository } from './interfaces';

@Injectable()
export class ConsultantOnboardingQuestionRepository
  extends AbstractRepository<ConsultantOnboardingQuestion>
  implements IConsultantOnboardingQuestionRepository
{
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(ConsultantOnboardingQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantOnboardingQuestionRepository(manager) as this;
  }

  public async findByOnboardingId(onboardingId: string): Promise<ConsultantOnboardingQuestion[]> {
    return this.repository.find({
      where: { onboardingId },
      order: { questionOrder: 'ASC' },
    });
  }
}
