import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';
import { AdminConsultantSkillExamController } from './controllers/admin-consultant-skill-exam.controller';
import { AdminConsultantSkillExamService } from './services/admin-consultant-skill-exam.service';

// Read-only admin views for skill exams. The flow is fully automated — there
// is no admin write / decide endpoint on this module.
//
// Endpoints under /admin/skill-exams (@Roles(ADMIN_PLATFORM)):
//   GET    /                paginated list (filter by status, consultant_id, skill_id)
//   GET    /:examId         detail with 20 Q&As + per-answer Copyleaks + AI eval scores + feedback
@Module({
  imports: [UnitOfWorkModule],
  controllers: [AdminConsultantSkillExamController],
  providers: [AdminConsultantSkillExamService],
  exports: [AdminConsultantSkillExamService],
})
export class AdminConsultantSkillExamModule {}
