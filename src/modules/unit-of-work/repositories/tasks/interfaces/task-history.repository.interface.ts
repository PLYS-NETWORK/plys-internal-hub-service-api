import { AbstractRepository } from '@common/repositories';
import { TaskHistory } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITaskHistoryRepository extends AbstractRepository<TaskHistory> {}
