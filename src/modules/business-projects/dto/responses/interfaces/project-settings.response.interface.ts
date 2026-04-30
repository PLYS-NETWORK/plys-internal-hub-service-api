export interface IProjectSettingsRequiredSkill {
  id: string;
  name: string;
}

export interface IProjectSettingsInterviewQuestion {
  id: string;
  question_text: string;
  display_order: number;
  is_required: boolean;
}

export interface IProjectSettingsResponse {
  title: string;
  introduction: Record<string, unknown> | null;
  required_skills: IProjectSettingsRequiredSkill[];
  max_consultants: number;
  interview_questions: IProjectSettingsInterviewQuestion[];
}
