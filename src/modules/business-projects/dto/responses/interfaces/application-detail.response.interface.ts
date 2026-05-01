import { ApplicationStatus, ProficiencyLevel } from '@database/enums';

export interface IApplicationConsultantSkill {
  id: string;
  name: string;
  proficiency_level: ProficiencyLevel;
  years_with_skill: number | null;
}

export interface IApplicationDetailConsultant {
  id: string;
  full_name: string;
  avatar_url: string | null;
  skills: IApplicationConsultantSkill[];
}

export interface IApplicationInterviewAnswer {
  question_id: string;
  question_text_snapshot: string;
  answer: Record<string, unknown> | null;
  is_question_deleted: boolean;
}

export interface IApplicationDetailResponse {
  id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  applied_at: Date;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  matching_rate: number;
  consultant: IApplicationDetailConsultant;
  interview_answers: IApplicationInterviewAnswer[];
}
