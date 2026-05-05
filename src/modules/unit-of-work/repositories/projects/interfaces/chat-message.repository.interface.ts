import { AbstractRepository } from '@common/repositories';
import { ChatMessage } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IChatMessageRepository extends AbstractRepository<ChatMessage> {}
