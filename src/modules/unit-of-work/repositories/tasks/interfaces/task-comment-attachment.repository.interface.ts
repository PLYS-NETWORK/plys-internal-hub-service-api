import { AbstractRepository } from '@common/repositories';
import { TaskCommentAttachment } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITaskCommentAttachmentRepository
  extends AbstractRepository<TaskCommentAttachment> {}
