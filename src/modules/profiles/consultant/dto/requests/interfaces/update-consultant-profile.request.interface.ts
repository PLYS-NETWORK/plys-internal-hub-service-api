import { IConsultantSkillInputRequest } from './consultant-skill-input.request.interface';

export interface IUpdateConsultantProfileRequest {
  readonly full_name?: string;
  readonly bio?: string;
  readonly years_of_experience?: number;
  readonly address_line?: string;
  readonly city?: string;
  readonly state_province?: string;
  readonly postal_code?: string;
  readonly country_code?: string;
  readonly phone_number?: string;
  readonly skills?: IConsultantSkillInputRequest[];
}
