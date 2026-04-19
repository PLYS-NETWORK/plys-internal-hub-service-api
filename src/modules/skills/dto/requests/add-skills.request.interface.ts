export interface IAddSkillItemRequest {
  readonly name: string;
  readonly category?: string;
}

export interface IAddSkillsRequest {
  readonly skills: IAddSkillItemRequest[];
}
