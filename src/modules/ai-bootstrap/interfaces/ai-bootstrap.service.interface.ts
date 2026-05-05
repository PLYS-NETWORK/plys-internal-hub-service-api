import { AiBootstrapResponseDto } from '../dto/responses';

export interface IAiBootstrapService {
  /**
   * Aggregates everything the chat panel needs on open: project state, the
   * AI-context snapshot (or null if not yet derived), the calling user's
   * sessions, live tasks, project-required skills, and the catalog. Single
   * round trip — saves the FE from fanning out to ~5 endpoints per chat open.
   *
   * @param projectId Project being chatted about.
   * @returns Bootstrap aggregate.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   */
  bootstrap(projectId: string): Promise<AiBootstrapResponseDto>;
}
