import { ConsultantProfile, Project, ProjectMember } from '@database/entities';

export interface IResolvedAccessibleProject {
  project: Project;
  consultantProfile: ConsultantProfile;
}

export interface IResolvedProjectMembership {
  project: Project;
  consultantProfile: ConsultantProfile;
  member: ProjectMember;
}

/**
 * Centralised tenant resolution for the consultant-projects module. Mirrors
 * `BusinessAccessService`. Every endpoint must call one of the resolve
 * methods to verify the JWT user matches an existing consultant profile and
 * (when needed) is an active member of the requested project.
 */
export interface IConsultantAccessService {
  /**
   * Verifies the calling user has a consultant profile. Used by the public
   * discovery endpoints which only require a consultant identity (no project
   * membership).
   *
   * @returns The verified consultant profile.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   */
  resolveConsultantProfile(): Promise<ConsultantProfile>;

  /**
   * Loads the project for the discovery flow. Allows access if the project
   * is in a publicly-discoverable status (PUBLISHED, IN_PROGRESS) OR if the
   * caller already has an ACTIVE membership.
   *
   * @returns The project plus the verified consultant profile.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *         missing/soft-deleted, or accessible to neither the public nor
   *         the calling consultant.
   */
  resolveAccessibleProject(projectId: string): Promise<IResolvedAccessibleProject>;

  /**
   * Asserts the calling consultant is an ACTIVE member of the project. Used
   * by overview / board endpoints. Returns the project, profile, and member
   * row in one trip.
   *
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project does
   *         not exist or is soft-deleted.
   * @throws TranslatableException 403 PROJECT_FORBIDDEN when the consultant
   *         is not an ACTIVE member of the project.
   */
  resolveProjectMembership(projectId: string): Promise<IResolvedProjectMembership>;
}
