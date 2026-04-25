import { ProjectStatus } from '@database/enums';

import { IProjectInterviewQuestionResponse } from './project-interview-question.response.interface';
import { IProjectSkillResponse } from './project-skill.response.interface';

export interface ICompanyAddressResponse {
  /** Street-level address line; `null` when the business has not provided it. */
  readonly address_line: string | null;
  /** City name; `null` when not provided. */
  readonly city: string | null;
  /** State or province name; `null` when not provided. */
  readonly state_province: string | null;
  /** Postal / ZIP code; `null` when not provided. */
  readonly postal_code: string | null;
  /** ISO 3166-1 alpha-2 country code (e.g. `"US"`); `null` when not provided. */
  readonly country_code: string | null;
}

export interface IConsultantProjectResponse {
  /** UUID of the project. */
  id: string;
  /** UUID of the business that owns this project. */
  business_id: string;
  /** Human-readable project title. */
  title: string;
  /** Optional rich-text introduction visible to consultants (TipTap/ProseMirror JSON document); `null` when not provided. */
  introduction: Record<string, unknown> | null;
  /** Current lifecycle status of the project (always `public` in consultant-facing lists). */
  status: ProjectStatus;
  /** Total number of consultant seats the business wants to fill. */
  required_consultants: number;
  /** Timestamp when the project was published; `null` if not yet published. */
  published_at: Date | null;
  /** Timestamp when the project moved to an active state; `null` until then. */
  started_at: Date | null;
  /** Timestamp when the project was cancelled; `null` if still active. */
  cancelled_at: Date | null;
  /** Billing model: `"per_task"` charges per completed task; `"monthly"` is a flat monthly rate. */
  payment_type: 'per_task' | 'monthly';
  /** Registered company name of the business posting the project. */
  company_name: string;
  /** Physical address of the company; individual fields may be `null` if incomplete. */
  company_address: ICompanyAddressResponse;
  /** `true` if the business is on the partner platform (Ployos); `false` for standard businesses. */
  is_partner_platform: boolean;
  /** Skills required for this project; empty array if none are defined. */
  skills: IProjectSkillResponse[];
  /** Interview questions the business has set for applicants; empty array if none configured. */
  interview_questions: IProjectInterviewQuestionResponse[];
}
