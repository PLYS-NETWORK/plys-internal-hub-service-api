import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { IProfilesUnitOfWork } from './interfaces/profiles-unit-of-work.interface';
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
  OnboardingQuestionRepository,
  SkillRepository,
  UserRepository,
  UserSessionRepository,
} from './repositories';

class TransactionalProfilesUnitOfWork implements IProfilesUnitOfWork {
  constructor(
    public readonly users: IUserRepository,
    public readonly userSessions: IUserSessionRepository,
    public readonly businessProfiles: IBusinessProfileRepository,
    public readonly skills: ISkillRepository,
    public readonly consultantProfiles: IConsultantProfileRepository,
    public readonly consultantSkills: IConsultantSkillRepository,
    public readonly consultantOnboardings: IConsultantOnboardingRepository,
    public readonly consultantOnboardingAnswers: IConsultantOnboardingAnswerRepository,
    public readonly onboardingQuestions: IOnboardingQuestionRepository,
    public readonly consultantSkillExams: IConsultantSkillExamRepository,
    public readonly consultantSkillExamQuestions: IConsultantSkillExamQuestionRepository,
    public readonly consultantSkillExamAnswers: IConsultantSkillExamAnswerRepository,
    public readonly consultantSkillScores: IConsultantSkillScoreRepository,
  ) {}

  public async withTransaction<T>(work: (uow: IProfilesUnitOfWork) => Promise<T>): Promise<T> {
    return work(this);
  }
}

@Injectable()
export class ProfilesUnitOfWorkService implements IProfilesUnitOfWork {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    public readonly users: UserRepository,
    public readonly userSessions: UserSessionRepository,
    public readonly businessProfiles: BusinessProfileRepository,
    public readonly skills: SkillRepository,
    public readonly consultantProfiles: ConsultantProfileRepository,
    public readonly consultantSkills: ConsultantSkillRepository,
    public readonly consultantOnboardings: ConsultantOnboardingRepository,
    public readonly consultantOnboardingAnswers: ConsultantOnboardingAnswerRepository,
    public readonly onboardingQuestions: OnboardingQuestionRepository,
    public readonly consultantSkillExams: ConsultantSkillExamRepository,
    public readonly consultantSkillExamQuestions: ConsultantSkillExamQuestionRepository,
    public readonly consultantSkillExamAnswers: ConsultantSkillExamAnswerRepository,
    public readonly consultantSkillScores: ConsultantSkillScoreRepository,
  ) {}

  public async withTransaction<T>(work: (uow: IProfilesUnitOfWork) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { manager } = queryRunner;
      const txUow = new TransactionalProfilesUnitOfWork(
        this.users.withManager(manager),
        this.userSessions.withManager(manager),
        this.businessProfiles.withManager(manager),
        this.skills.withManager(manager),
        this.consultantProfiles.withManager(manager),
        this.consultantSkills.withManager(manager),
        this.consultantOnboardings.withManager(manager),
        this.consultantOnboardingAnswers.withManager(manager),
        this.onboardingQuestions.withManager(manager),
        this.consultantSkillExams.withManager(manager),
        this.consultantSkillExamQuestions.withManager(manager),
        this.consultantSkillExamAnswers.withManager(manager),
        this.consultantSkillScores.withManager(manager),
      );

      const result = await work(txUow);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
