export interface IProjectPublishedEvent {
  readonly project_id: string;
  readonly project_code: string;
  readonly project_title: string;
  readonly business_user_id: string;
  readonly business_id: string;
  readonly business_name: string;
  /** Skill IDs required by the project — used for consultant skill-match fan-out. */
  readonly required_skill_ids: string[];
}

export interface IProjectUnpublishedEvent {
  readonly project_id: string;
  readonly project_code: string;
  readonly project_title: string;
  readonly business_user_id: string;
  readonly business_id: string;
  readonly refund_amount?: number;
}
