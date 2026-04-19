import { IConsultantSkillResponse } from './consultant-skill.response.interface';

export interface IConsultantProfileResponse {
  readonly id: string;
  readonly user_id: string;
  readonly full_name: string;
  readonly bio: string | null;
  readonly years_of_experience: number | null;
  readonly availability: string | null;
  readonly avatar_url: string | null;
  readonly address_line: string | null;
  readonly city: string | null;
  readonly state_province: string | null;
  readonly postal_code: string | null;
  readonly country_code: string | null;
  readonly phone_number: string | null;
  readonly is_verified: boolean;
  readonly created_at: Date;
  readonly skills: IConsultantSkillResponse[];
}
