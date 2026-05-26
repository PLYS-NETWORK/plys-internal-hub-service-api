import { ConsultantSkillPerformanceDto } from '../../../dto/requests/consultant-skill-performance.dto';
import { ConsultantSkillPerformanceResponseDto } from '../../../dto/responses/consultant-skill-performance-response.dto';

/**
 * Per-skill performance table for the caller. Joins `consultant_skills`,
 * skill-exam history, and downstream earnings/tasks-completed counts that
 * trace back through `project_required_skills`.
 */
export interface IConsultantSkillPerformanceService {
  /**
   * @param dto Page-size limit + sort directive.
   * @throws TranslatableException (403) — `CONSULTANT_PROFILE_NOT_FOUND`.
   */
  get(dto: ConsultantSkillPerformanceDto): Promise<ConsultantSkillPerformanceResponseDto>;
}
