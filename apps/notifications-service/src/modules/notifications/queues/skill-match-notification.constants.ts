export const SKILL_MATCH_NOTIFICATION_QUEUE = 'skill_match_notification';

export const SKILL_MATCH_NOTIFICATION_JOBS = {
  DISPATCH_MATCHING_CONSULTANTS: 'dispatch_matching_consultants',
} as const;

export interface ISkillMatchJobPayload {
  readonly project_id: string;
  readonly project_code: string;
  readonly project_title: string;
  readonly business_id: string;
  readonly required_skill_ids: string[];
}
