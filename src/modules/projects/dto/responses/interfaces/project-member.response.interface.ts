export interface IProjectMemberAddressResponse {
  readonly address_line: string | null;
  readonly city: string | null;
  readonly state_province: string | null;
  readonly postal_code: string | null;
  readonly country_code: string | null;
}

export interface IProjectMemberResponse {
  readonly id: string;
  readonly consultant_id: string;
  readonly avatar_url: string | null;
  readonly full_name: string;
  readonly status: string;
  readonly joined_at: Date;
  readonly address: IProjectMemberAddressResponse;
}
