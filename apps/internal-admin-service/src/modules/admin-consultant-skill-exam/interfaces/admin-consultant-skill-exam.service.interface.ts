import { ListSkillExamsDto } from '../dto/requests/list-skill-exams.dto';
import { AdminSkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { AdminPaginatedSkillExamsResponseDto } from '../dto/responses/skill-exam-list-item-response.dto';

/**
 * Contract for the admin-side skill-exam viewer. Read-only — skill exams are
 * fully automated, there is no admin write/decide action.
 */
export interface IAdminConsultantSkillExamService {
  /**
   * Paginated list of skill exams. List columns: consultant full name,
   * skill name, AI eval score (rating), assigned proficiency (level), status.
   */
  list(dto: ListSkillExamsDto): Promise<AdminPaginatedSkillExamsResponseDto>;

  /**
   * Full detail: exam metadata + 20 Q&As + per-answer CopyLeaks + AI eval scores.
   *
   * @throws TranslatableException (404, SKILL_EXAM_NOT_FOUND).
   */
  getDetail(examId: string): Promise<AdminSkillExamDetailResponseDto>;
}
