import { AbstractRepository } from '@common/repositories';
import { ProjectApplication } from '@database/entities';
import { ApplicationStatus } from '@database/enums';

export interface IApplicationFunnelCounts {
  applied: number;
  reviewed: number;
  approved: number;
}

export interface IApplicationsPerProjectRow {
  project_id: string;
  project_name: string;
  total_applications: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  withdrawn_count: number;
}

export interface IPendingApplicationRow {
  application_id: string;
  project_id: string;
  project_name: string;
  consultant_id: string;
  consultant_name: string;
  applied_at: Date;
  has_answered_questions: boolean;
}

export interface IProjectApplicationRepository extends AbstractRepository<ProjectApplication> {
  /**
   * Returns the funnel counts for the given projects in a single SQL round-trip.
   * `applied`   = COUNT(*) (every status)
   * `reviewed`  = COUNT WHERE reviewed_at IS NOT NULL
   * `approved`  = COUNT WHERE status = accepted
   *
   * Date range filter applies to `applied_at`.
   */
  countFunnelByProjectIds(
    projectIds: string[],
    from?: string,
    to?: string,
    projectIdFilter?: string,
  ): Promise<IApplicationFunnelCounts>;

  /**
   * Returns per-project application breakdown (total + pending + approved +
   * rejected) sorted by total desc.
   */
  countByProjectIdsGroupedByProjectAndStatus(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<IApplicationsPerProjectRow[]>;

  /** Total `pending` applications across the given projects. */
  countPendingByProjectIds(projectIds: string[]): Promise<number>;

  /**
   * Returns the count of applications matching a single project + status —
   * used by the project overview header / members card to surface things like
   * pending-approval count without dragging in the full per-project group-by.
   */
  countByProjectIdAndStatus(projectId: string, status: ApplicationStatus): Promise<number>;

  /**
   * Returns a page of `pending` applications joined to project + consultant +
   * a derived `has_answered_questions` flag (true when the consultant has
   * answered every `is_required` question for that project, or when the
   * project has no required questions at all).
   */
  findPendingByProjectIds(
    projectIds: string[],
    skip: number,
    take: number,
  ): Promise<[IPendingApplicationRow[], number]>;

  /**
   * True when the consultant currently has a non-terminal application for the
   * project (`PENDING` or `ACCEPTED`). Used to drive the consultant
   * discovery feed's `is_applied` flag.
   */
  existsActiveByConsultantAndProject(consultantId: string, projectId: string): Promise<boolean>;

  /**
   * For each (consultant, project) pair with an active application
   * (`PENDING` or `ACCEPTED`), returns the project ids the consultant has
   * already applied to. Used to drive the consultant discovery feed's
   * `is_applied` flag in a single round-trip.
   */
  findActiveProjectIdsByConsultantAndProjects(
    consultantId: string,
    projectIds: string[],
  ): Promise<Set<string>>;
}
