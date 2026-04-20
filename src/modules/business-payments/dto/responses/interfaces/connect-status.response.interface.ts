export interface IConnectStatusResponse {
  is_connected: boolean;
  account_id: string | null;
  onboarding_url: string | null;
}
