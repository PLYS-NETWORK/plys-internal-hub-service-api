import { Module } from '@nestjs/common';

import { ProfilesUnitOfWorkService } from './profiles-unit-of-work.service';
import {
  BusinessProfileRepository,
  ConsultantOnboardingAnswerRepository,
  ConsultantOnboardingRepository,
  ConsultantProfileRepository,
  ConsultantSkillExamAnswerRepository,
  ConsultantSkillExamQuestionRepository,
  ConsultantSkillExamRepository,
  ConsultantSkillRepository,
  ConsultantSkillScoreRepository,
  OnboardingQuestionRepository,
  SkillRepository,
  UserRepository,
  UserSessionRepository,
} from './repositories';

const repositories = [
  UserRepository,
  UserSessionRepository,
  BusinessProfileRepository,
  SkillRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
  ConsultantOnboardingRepository,
  ConsultantOnboardingAnswerRepository,
  OnboardingQuestionRepository,
  ConsultantSkillExamRepository,
  ConsultantSkillExamQuestionRepository,
  ConsultantSkillExamAnswerRepository,
  ConsultantSkillScoreRepository,
];

@Module({
  providers: [ProfilesUnitOfWorkService, ...repositories],
  exports: [ProfilesUnitOfWorkService],
})
export class ProfilesUnitOfWorkModule {}
