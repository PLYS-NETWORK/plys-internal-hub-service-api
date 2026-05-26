import { IUnitOfWork } from './unit-of-work.interface';

/** Projects bounded context — profile tables are accessed via @plys/libraries/profiles-port only. */
export type IProjectsUnitOfWork = Omit<
  IUnitOfWork,
  | 'businessProfiles'
  | 'consultantProfiles'
  | 'consultantSkills'
  | 'skills'
  | 'consultantOnboardings'
  | 'consultantOnboardingAnswers'
  | 'onboardingQuestions'
  | 'consultantSkillExams'
  | 'consultantSkillExamQuestions'
  | 'consultantSkillExamAnswers'
  | 'consultantSkillScores'
>;
