import { EmailModule } from '@common/modules/email';
import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';

// TODO(refactor): admin onboarding review/approve module.
//
// Endpoints under /admin/onboardings (@Roles(ADMIN_PLATFORM)):
//   GET    /                            paginated list with status filter
//   GET    /:id                         detail with 10 Q&As
//   POST   /:id/decide                  { decision: APPROVED|REJECTED, rejection_note? }
//                                       APPROVED → ConsultantProfile.isVerified=true
//                                       REJECTED → blockedUntil = now + 3 months
//                                       Email consultant with outcome.
@Module({
  imports: [UnitOfWorkModule, EmailModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class AdminConsultantOnboardingModule {}
