import { Order } from '@plys/libraries/common-nest/dto/page-options.dto';
import { AiAssistantType } from '@plys/libraries/database/enums';

export interface IListApiKeysRequest {
  page: number;
  limit: number;
  sort_by?: string;
  order_by?: Order;
  assistantType?: AiAssistantType;
  model?: string;
  keywords?: string;
}
