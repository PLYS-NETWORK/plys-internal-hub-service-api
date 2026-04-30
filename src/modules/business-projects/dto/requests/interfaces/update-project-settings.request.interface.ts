export interface IUpdateProjectSettingsRequest {
  title?: string;
  introduction?: Record<string, unknown> | null;
  requiredSkills?: string[];
  maxConsultants?: number;
}
