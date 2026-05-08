import { AiAssistantType, AiProvider } from '@database/enums';

export interface ICreateApiKeyRequest {
  assistantType: AiAssistantType;
  provider: AiProvider;
  model: string;
  label: string;
  key: string;
}
