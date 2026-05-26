export interface ISkillResponse {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly category: string | null;
  readonly category_label: string | null;
  readonly created_at: Date;
}
