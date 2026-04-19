import { AbstractRepository } from '@common/repositories';
import { Task } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITaskRepository extends AbstractRepository<Task> {}
