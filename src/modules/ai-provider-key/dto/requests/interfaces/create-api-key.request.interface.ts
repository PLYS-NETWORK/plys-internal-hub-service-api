import { AiProvider } from '@database/enums';

export interface ICreateApiKeyRequest {
  provider: AiProvider;
  model: string;
  label: string;
  key: string;
}
