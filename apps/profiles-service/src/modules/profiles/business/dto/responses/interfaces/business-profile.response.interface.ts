export interface IBusinessProfileResponse {
  /** UUID of the business profile record. */
  readonly id: string;
  /** UUID of the linked auth user account. */
  readonly user_id: string;
  /** Registered company name. */
  readonly company_name: string;
  /** Full name of the business owner captured at registration; `null` for legacy profiles. */
  readonly owner_name: string | null;
  /** Tax identification number paired with `country_code`; `null` for legacy profiles pre-onboarding. */
  readonly tax_id: string | null;
  /** Industry sector the company operates in; `null` when not provided. */
  readonly industry: string | null;
  /** Company size band (e.g. `"1-10"`, `"50-200"`); `null` when not provided. */
  readonly company_size: string | null;
  /** Public website URL of the company; `null` when not provided. */
  readonly website_url: string | null;
  /** Short company description shown to consultants; `null` when not provided. */
  readonly description: string | null;
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
  /** CDN URL of the company logo image; `null` when no logo has been uploaded. */
  readonly logo_url: string | null;
  /** `true` when an admin has verified the business; `false` otherwise. */
  readonly is_verified: boolean;
  /** `true` if the business is on the partner platform (Ployos); `false` for standard businesses. */
  readonly is_partner_platform: boolean;
  /** `true` when the business may pay invoices via credit instead of upfront balance deduction. */
  readonly allow_payment_credit: boolean;
  /** Current pre-paid wallet balance, in the platform's base currency. */
  readonly account_balance: number;
  /** Timestamp when the business profile was created. */
  readonly created_at: Date;
}
