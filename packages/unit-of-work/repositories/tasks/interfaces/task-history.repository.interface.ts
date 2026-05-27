import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { TaskHistory } from '@plys/libraries/database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITaskHistoryRepository extends AbstractRepository<TaskHistory> {}
