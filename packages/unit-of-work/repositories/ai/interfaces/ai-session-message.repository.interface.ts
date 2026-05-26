import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { AiSessionMessage } from '@plys/libraries/database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IAiSessionMessageRepository extends AbstractRepository<AiSessionMessage> {}
