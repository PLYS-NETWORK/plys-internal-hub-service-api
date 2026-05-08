export interface IProjectSettingsRequiredSkill {
  id: string;
  name: string;
}

export interface IProjectSettingsResponse {
  title: string;
  introduction: Record<string, unknown> | null;
  required_skills: IProjectSettingsRequiredSkill[];
  max_consultants: number;
}
