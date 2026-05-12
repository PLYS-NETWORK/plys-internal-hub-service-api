import { EmailModule } from '@common/modules/email';
import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';

// TODO(refactor): implement the consultant-onboarding flow per
// docs/api-specs/consultant-onboarding/consultant.md
//
// Required files (per plan):
// - controllers/consultant-onboarding.controller.ts
// - services/consultant-onboarding.service.ts
// - services/onboarding-interview.service.ts
// - dto/requests/submit-onboarding-profile.dto.ts (+ .request.interface.ts)
// - dto/requests/submit-onboarding-answer.dto.ts (+ .request.interface.ts)
// - dto/responses/onboarding-status-response.dto.ts (+ .response.interface.ts)
// - dto/responses/onboarding-question-response.dto.ts (+ .response.interface.ts)
// - interfaces/consultant-onboarding.service.interface.ts
// - interfaces/onboarding-interview.service.interface.ts
//
// Endpoints to expose under /consultant/onboarding (Bearer auth required,
// @Roles(USER), @Platform(CONSULTANT)):
//   GET    /status
//   POST   /profile  (full_name, bio, years_of_experience, phone_number, country_code,
//                     avatar_url?, cv_url?)  → creates onboarding, advances to IN_INTERVIEW,
//                     synchronously assigns 5 COMMUNICATION + 5 SYSTEM_KNOWLEDGE questions
//                     from `interview_questions` via uow.interviewQuestions.findRandomActiveByType()
//   GET    /interview
//   POST   /interview/answers
//   POST   /interview/submit → INTERVIEW_SUBMITTED + email consultant + email admins
@Module({
  imports: [UnitOfWorkModule, EmailModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class ConsultantOnboardingModule {}
