import { AbstractRepository } from '@common/repositories';
import { ConsultantOnboarding } from '@database/entities';
import { OnboardingStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantOnboardingRepository } from './interfaces';

@Injectable()
export class ConsultantOnboardingRepository
  extends AbstractRepository<ConsultantOnboarding>
  implements IConsultantOnboardingRepository
{
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(ConsultantOnboarding, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantOnboardingRepository(manager) as this;
  }

  public async findByUserId(userId: string): Promise<ConsultantOnboarding | null> {
    return this.repository.findOne({ where: { userId } });
  }

  /** @inheritdoc */
  public async countPendingReview(): Promise<number> {
    return this.repository.count({ where: { status: OnboardingStatus.INTERVIEW_SUBMITTED } });
  }
}
