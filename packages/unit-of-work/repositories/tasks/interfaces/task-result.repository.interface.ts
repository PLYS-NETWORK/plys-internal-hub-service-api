import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { TaskResult } from '@plys/libraries/database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITaskResultRepository extends AbstractRepository<TaskResult> {}
