/**
 * Shared address-field contract for both business and consultant profile DTOs.
 *
 * The two onboard DTOs declare these fields independently (so `PartialType` and
 * class-validator decorators compose cleanly with each platform's other fields)
 * but every property MUST follow the rules documented here. When introducing a
 * new address-related field or tightening a constraint, update this file first
 * so the two DTOs can be brought back into alignment.
 *
 * | Property        | Type     | Validation                                          | Notes                          |
 * |-----------------|----------|-----------------------------------------------------|--------------------------------|
 * | address_line    | string   | optional / `@IsString()`                            | Free-form street address       |
 * | city            | string   | optional / `@IsString()`                            |                                |
 * | state_province  | string   | optional / `@IsString()`                            | "State", "Province", "Region"  |
 * | postal_code     | string   | optional / `@IsString()`                            | Country-dependent format       |
 * | country_code    | string   | optional / `@IsString()` `@Length(2,2)` `@IsUppercase()` | ISO 3166-1 alpha-2 (e.g. "US") |
 * | phone_number    | string   | optional / `@IsString()`                            | E.164 recommended              |
 *
 * Both `BusinessProfile` and `ConsultantProfile` entities persist these as
 * `varchar` columns in their respective tables. Keep entity column types in
 * sync if you change the validation rules here.
 */
export const ADDRESS_FIELDS = [
  'address_line',
  'city',
  'state_province',
  'postal_code',
  'country_code',
  'phone_number',
] as const;

export type AddressFieldKey = (typeof ADDRESS_FIELDS)[number];
