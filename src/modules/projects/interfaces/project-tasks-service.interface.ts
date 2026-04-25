import { Task } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

import { TaskItemDto } from '../dto/requests/task-item.dto';

export interface IProjectTasksService {
  /**
   * Retrieves all tasks associated with the given project.
   *
   * @param projectId - UUID of the project whose tasks are fetched.
   * @param uow       - Optional Unit of Work; uses default connection when omitted.
   * @returns Array of Task entities ordered by `display_order`; empty array if none exist.
   */
  findByProjectId(projectId: string, uow?: IUnitOfWork): Promise<Task[]>;

  /**
   * Inserts a new set of tasks for the given project within the provided transaction.
   *
   * @param projectId - UUID of the project to attach tasks to.
   * @param items     - Ordered list of task payloads to insert.
   * @param uow       - Active Unit of Work — caller must supply an open transaction.
   * @returns Array of the newly created Task entities.
   */
  createForProject(projectId: string, items: TaskItemDto[], uow: IUnitOfWork): Promise<Task[]>;

  /**
   * Deletes all existing tasks for the project and inserts the new set atomically.
   *
   * Use this when the client sends a full replacement of the task list (e.g., on
   * project update). The delete and insert share the same transaction as the caller.
   *
   * @param projectId - UUID of the project whose tasks are replaced.
   * @param items     - New ordered list of task payloads; may be empty to clear all tasks.
   * @param uow       - Active Unit of Work — caller must supply an open transaction.
   * @returns Array of the newly created Task entities after replacement.
   */
  replaceForProject(projectId: string, items: TaskItemDto[], uow: IUnitOfWork): Promise<Task[]>;
}
