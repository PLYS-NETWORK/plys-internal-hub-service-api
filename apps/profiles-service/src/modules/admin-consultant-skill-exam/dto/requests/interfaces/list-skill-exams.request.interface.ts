export interface IListSkillExamsRequest {
  readonly status?: string;
  readonly consultantId?: string;
  readonly skillId?: string;
  readonly page?: number;
  readonly take?: number;
}
