import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';

// TODO(refactor): admin read-only audit views for skill exams.
//
// Endpoints under /admin/skill-exams (@Roles(ADMIN_PLATFORM)):
//   GET    /                paginated list (filter by status, consultantId, skillId, date range)
//   GET    /:examId         detail with 20 Q&As + per-answer Copyleaks + AI eval scores + feedback
//
// No admin write endpoints — skill exams are fully automated.
@Module({
  imports: [UnitOfWorkModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class AdminConsultantSkillExamModule {}
