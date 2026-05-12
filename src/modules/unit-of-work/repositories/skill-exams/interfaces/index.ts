import { AbstractRepository } from '@common/repositories';
import {
  ConsultantSkillExam,
  ConsultantSkillExamAnswer,
  ConsultantSkillExamQuestion,
} from '@database/entities';

export interface IConsultantSkillExamRepository extends AbstractRepository<ConsultantSkillExam> {
  countInProgressByConsultant(consultantId: string): Promise<number>;
  findLatestByConsultantAndSkill(
    consultantId: string,
    skillId: string,
  ): Promise<ConsultantSkillExam | null>;
  findByConsultant(consultantId: string): Promise<ConsultantSkillExam[]>;
  countAttemptsByConsultantAndSkill(consultantId: string, skillId: string): Promise<number>;
}

export interface IConsultantSkillExamQuestionRepository extends AbstractRepository<ConsultantSkillExamQuestion> {
  findByExamId(examId: string): Promise<ConsultantSkillExamQuestion[]>;
}

export interface IConsultantSkillExamAnswerRepository extends AbstractRepository<ConsultantSkillExamAnswer> {
  findByExamId(examId: string): Promise<ConsultantSkillExamAnswer[]>;
}
