import { AbstractRepository } from '@common/repositories';
import { TaskComment } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITaskCommentRepository extends AbstractRepository<TaskComment> {}
