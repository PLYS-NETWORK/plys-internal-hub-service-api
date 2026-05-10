import { AbstractRepository } from '@common/repositories';
import { ConsultantApplication } from '@database/entities';
import { ApplicationStatus } from '@database/enums';

export interface IConsultantApplicationRepository extends AbstractRepository<ConsultantApplication> {
  /**
   * Finds the most recent application for a user regardless of status.
   * Used to determine block status and prevent duplicate active applications.
   *
   * @param userId - The user's UUID.
   * @returns The latest ConsultantApplication row, or null if none exists.
   */
  findLatestByUserId(userId: string): Promise<ConsultantApplication | null>;

  /**
   * Finds the active (non-terminal) application for a user.
   * A user can only have one active application at a time.
   *
   * @param userId - The user's UUID.
   * @returns The active ConsultantApplication, or null if none is in progress.
   */
  findActiveByUserId(userId: string): Promise<ConsultantApplication | null>;

  /**
   * Returns a paginated list of applications optionally filtered by status.
   *
   * @param filters - Pagination and filter options.
   * @returns Tuple of [rows, total count].
   */
  findManyWithFilters(filters: {
    status?: ApplicationStatus;
    keyword?: string;
    page: number;
    take: number;
  }): Promise<[ConsultantApplication[], number]>;
}
