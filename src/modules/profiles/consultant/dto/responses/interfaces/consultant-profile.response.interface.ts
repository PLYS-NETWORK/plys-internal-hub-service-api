import { IConsultantSkillResponse } from './consultant-skill.response.interface';

export interface IConsultantProfileResponse {
  /** UUID of the consultant profile record. */
  readonly id: string;
  /** UUID of the linked auth user account. */
  readonly user_id: string;
  /** Full display name of the consultant. */
  readonly full_name: string;
  /** Short professional biography; `null` when not provided. */
  readonly bio: string | null;
  /** Total years of professional experience; `null` when not provided. */
  readonly years_of_experience: number | null;
  /** CDN URL of the profile avatar image; `null` when no avatar has been uploaded. */
  readonly avatar_url: string | null;
  /** Street-level address line; `null` when not provided. */
  readonly address_line: string | null;
  /** City name; `null` when not provided. */
  readonly city: string | null;
  /** State or province name; `null` when not provided. */
  readonly state_province: string | null;
  /** Postal / ZIP code; `null` when not provided. */
  readonly postal_code: string | null;
  /** ISO 3166-1 alpha-2 country code (e.g. `"US"`); `null` when not provided. */
  readonly country_code: string | null;
  /** Contact phone number in E.164 format; `null` when not provided. */
  readonly phone_number: string | null;
  /** `true` when an admin has verified the consultant's identity; `false` otherwise. */
  readonly is_verified: boolean;
  /** Current wallet balance available for withdrawal, in the platform's base currency. */
  readonly account_balance: number;
  /** Timestamp when the consultant profile was created. */
  readonly created_at: Date;
  /** List of skills the consultant has declared; empty array if none are defined. */
  readonly skills: IConsultantSkillResponse[];
}
