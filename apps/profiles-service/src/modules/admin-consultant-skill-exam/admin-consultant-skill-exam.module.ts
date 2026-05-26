import { Module } from '@nestjs/common';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { AdminConsultantSkillExamService } from './services/admin-consultant-skill-exam.service';

// Read-only admin views for skill exams. The flow is fully automated — there
// is no admin write / decide endpoint on this module.
//
// Endpoints under /admin/skill-exams (@Roles(ADMIN_PLATFORM)):
//   GET    /                paginated list (filter by status, consultant_id, skill_id)
//   GET    /:examId         detail with 20 Q&As + per-answer Copyleaks + AI eval scores + feedback
@Module({
  imports: [ProfilesUnitOfWorkModule],
  controllers: [],
  providers: [AdminConsultantSkillExamService],
  exports: [AdminConsultantSkillExamService],
})
export class AdminConsultantSkillExamModule {}
