import { ChatSessionMode } from '@database/enums';

export interface ICreateSessionRequest {
  mode: ChatSessionMode;
  title: string;
}
