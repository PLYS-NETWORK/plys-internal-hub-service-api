import { AbstractRepository } from '@common/repositories';
import { TaskDispute } from '@database/entities';

export interface ITaskDisputeRepository extends AbstractRepository<TaskDispute> {
  /**
   * Counts task disputes in `OPEN` status. Used by the admin dashboard's
   * operational-queues card.
   */
  countOpen(): Promise<number>;
}
