import { ChatSessionMode } from '@plys/libraries/database/enums';

export interface ICreateSessionRequest {
  mode: ChatSessionMode;
  title: string;
}
