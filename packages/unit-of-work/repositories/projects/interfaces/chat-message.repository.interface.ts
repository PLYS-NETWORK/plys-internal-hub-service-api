import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ChatMessage } from '@plys/libraries/database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IChatMessageRepository extends AbstractRepository<ChatMessage> {}
