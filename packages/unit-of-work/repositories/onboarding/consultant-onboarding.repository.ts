import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ConsultantOnboarding } from '@plys/libraries/database/entities';
import { OnboardingStatus } from '@plys/libraries/database/enums';
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
