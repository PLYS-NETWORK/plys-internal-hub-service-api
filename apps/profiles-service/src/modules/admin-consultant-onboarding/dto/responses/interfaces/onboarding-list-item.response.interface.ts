export interface IOnboardingListItemResponse {
  readonly id: string;
  readonly user_id: string;
  readonly consultant_email: string;
  readonly consultant_name: string;
  readonly status: string;
  readonly decision: string | null;
  readonly profile_submitted_at: string | null;
  readonly interview_submitted_at: string | null;
  readonly reviewed_at: string | null;
  readonly created_at: string;
}

export interface IPaginationMeta {
  readonly page: number;
  readonly take: number;
  readonly item_count: number;
  readonly page_count: number;
  readonly has_previous_page: boolean;
  readonly has_next_page: boolean;
}

export interface IPaginatedOnboardingsResponse {
  readonly data: IOnboardingListItemResponse[];
  readonly meta: IPaginationMeta;
}
