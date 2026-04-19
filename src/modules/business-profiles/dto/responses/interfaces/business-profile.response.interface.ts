export interface IBusinessProfileResponse {
  readonly id: string;
  readonly user_id: string;
  readonly company_name: string;
  readonly industry: string | null;
  readonly company_size: string | null;
  readonly website_url: string | null;
  readonly description: string | null;
  readonly address_line: string | null;
  readonly city: string | null;
  readonly state_province: string | null;
  readonly postal_code: string | null;
  readonly country_code: string | null;
  readonly phone_number: string | null;
  readonly logo_url: string | null;
  readonly is_verified: boolean;
  readonly is_partner_platform: boolean;
  readonly allow_payment_credit: boolean;
  readonly created_at: Date;
}
