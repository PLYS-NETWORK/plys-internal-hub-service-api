/**
 * TypeScript-internal (camelCase-free, post-transform) shape of the
 * business-onboarding payload. The class-level DTO accepts snake_case keys via
 * `@Expose({ name })`; this interface describes what the validated body looks
 * like after class-transformer has run.
 */
export interface IOnboardBusinessProfileRequest {
  readonly company_name: string;
  readonly owner_name: string;
  readonly tax_id: string;
  readonly industry: string;
  readonly company_size: string;
  readonly address_line: string;
  readonly city: string;
  readonly state_province: string;
  readonly postal_code: string;
  readonly country_code: string;
  readonly phone_number: string;
  readonly timezone?: string;
}
