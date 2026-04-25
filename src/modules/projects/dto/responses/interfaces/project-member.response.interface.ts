export interface IProjectMemberAddressResponse {
  /** Street-level address line; `null` when the consultant has not provided it. */
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

export interface IProjectMemberResponse {
  /** UUID of the project-member join record. */
  readonly id: string;
  /** UUID of the consultant profile. */
  readonly consultant_id: string;
  /** URL of the consultant's profile avatar; `null` when no avatar has been uploaded. */
  readonly avatar_url: string | null;
  /** Full display name of the consultant. */
  readonly full_name: string;
  /** Current membership status within the project (e.g. `"active"`, `"removed"`). */
  readonly status: string;
  /** Timestamp when the consultant joined the project. */
  readonly joined_at: Date;
  /** Location information for the consultant; individual fields may be `null` if incomplete. */
  readonly address: IProjectMemberAddressResponse;
}
