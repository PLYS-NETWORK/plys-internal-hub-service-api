import {
  IBusinessProfileRepository,
  IConsultantOnboardingAnswerRepository,
  IConsultantOnboardingRepository,
  IConsultantProfileRepository,
  IConsultantSkillExamAnswerRepository,
  IConsultantSkillExamQuestionRepository,
  IConsultantSkillExamRepository,
  IConsultantSkillRepository,
  IConsultantSkillScoreRepository,
  IOnboardingQuestionRepository,
  ISkillRepository,
  IUserRepository,
  IUserSessionRepository,
} from '../repositories';

export interface IProfilesUnitOfWork {
  readonly users: IUserRepository;
  readonly userSessions: IUserSessionRepository;
  readonly businessProfiles: IBusinessProfileRepository;
  readonly skills: ISkillRepository;
  readonly consultantProfiles: IConsultantProfileRepository;
  readonly consultantSkills: IConsultantSkillRepository;
  readonly consultantOnboardings: IConsultantOnboardingRepository;
  readonly consultantOnboardingAnswers: IConsultantOnboardingAnswerRepository;
  readonly onboardingQuestions: IOnboardingQuestionRepository;
  readonly consultantSkillExams: IConsultantSkillExamRepository;
  readonly consultantSkillExamQuestions: IConsultantSkillExamQuestionRepository;
  readonly consultantSkillExamAnswers: IConsultantSkillExamAnswerRepository;
  readonly consultantSkillScores: IConsultantSkillScoreRepository;

  withTransaction<T>(work: (uow: IProfilesUnitOfWork) => Promise<T>): Promise<T>;
}
