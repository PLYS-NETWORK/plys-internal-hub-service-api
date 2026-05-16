import { ConsultantProfile, Project } from '@database/entities';

export interface IResolvedAccessibleProject {
  project: Project;
  consultantProfile: ConsultantProfile;
}

/**
 * Tenant resolution for the consultant-projects module. Every endpoint must
 * call one of the resolve methods to verify the JWT user matches an existing
 * consultant profile before any business logic runs.
 */
export interface IConsultantAccessService {
  /**
   * Verifies the calling user has a consultant profile. Used by endpoints
   * that only require a consultant identity (no project membership).
   *
   * @returns The verified consultant profile.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND when the
   *         request context has no `userId` or the user has no consultant
   *         profile row.
   */
  resolveConsultantProfile(): Promise<ConsultantProfile>;

  /**
   * Loads a project for the discovery flow. Allows access when the project
   * is in a publicly-discoverable status (PUBLISHED, IN_PROGRESS) **or** when
   * the caller already has an ACTIVE membership on that project.
   *
   * @param projectId - UUID of the project to load.
   * @returns The project plus the verified consultant profile.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *         missing/soft-deleted or accessible to neither the public nor the
   *         calling consultant.
   */
  resolveAccessibleProject(projectId: string): Promise<IResolvedAccessibleProject>;
}
