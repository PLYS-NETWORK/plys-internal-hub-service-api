import { AiProvider } from '@database/enums';

// Shape returned by every admin endpoint. The plaintext key is never present;
// `key_masked` is computed from `key_last4` (`gsk_***...8c2f`).
export interface IApiKeyAdminResponse {
  id: string;
  provider: AiProvider;
  model: string;
  label: string;
  master_key_version: number;
  key_masked: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}
