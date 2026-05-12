import { AbstractRepository } from '@common/repositories';
import {
  ConsultantOnboarding,
  ConsultantOnboardingAnswer,
  ConsultantOnboardingQuestion,
} from '@database/entities';

export interface IConsultantOnboardingRepository extends AbstractRepository<ConsultantOnboarding> {
  findByUserId(userId: string): Promise<ConsultantOnboarding | null>;
}

export interface IConsultantOnboardingQuestionRepository extends AbstractRepository<ConsultantOnboardingQuestion> {
  findByOnboardingId(onboardingId: string): Promise<ConsultantOnboardingQuestion[]>;
}

export interface IConsultantOnboardingAnswerRepository extends AbstractRepository<ConsultantOnboardingAnswer> {
  findByOnboardingId(onboardingId: string): Promise<ConsultantOnboardingAnswer[]>;
}
