/**
 * Partial update shape for `PATCH /business-profiles/me`. Every field is
 * optional; any field present is applied to the existing business profile.
 *
 * Note: this interface is intentionally self-contained — the onboarding DTO
 * now lives in `@modules/business-onboarding`, so duplicating the field list
 * here avoids a cross-module type dependency.
 */
export interface IUpdateBusinessProfileRequest {
  readonly company_name?: string;
  readonly owner_name?: string;
  readonly tax_id?: string;
  readonly industry?: string;
  readonly company_size?: string;
  readonly address_line?: string;
  readonly city?: string;
  readonly state_province?: string;
  readonly postal_code?: string;
  readonly country_code?: string;
  readonly phone_number?: string;
  readonly timezone?: string;
}
