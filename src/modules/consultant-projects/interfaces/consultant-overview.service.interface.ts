import { ConsultantOverviewResponseDto } from '../dto/responses';

export interface IConsultantOverviewService {
  /**
   * Single aggregated overview for the calling consultant on the given
   * project. The shape of `earnings` and presence of `next_payment` are
   * branched on `project.payment_type`.
   *
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 403 PROJECT_FORBIDDEN.
   */
  getOverview(projectId: string): Promise<ConsultantOverviewResponseDto>;
}
