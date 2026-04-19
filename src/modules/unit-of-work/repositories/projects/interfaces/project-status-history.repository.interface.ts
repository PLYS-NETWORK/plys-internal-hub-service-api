import { AbstractRepository } from '@common/repositories';
import { ProjectStatusHistory } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IProjectStatusHistoryRepository
  extends AbstractRepository<ProjectStatusHistory> {}
