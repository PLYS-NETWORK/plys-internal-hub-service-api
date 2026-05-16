export interface IExploreProjectListItemResponse {
  readonly id: string;
  readonly title: string;
  readonly company_name: string;
  readonly company_logo_url: string | null;
  readonly is_partner_platform: boolean;
  readonly published_at: Date | null;
  readonly required_consultants: number;
}
