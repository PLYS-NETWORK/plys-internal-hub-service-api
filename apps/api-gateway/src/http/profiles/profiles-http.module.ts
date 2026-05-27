import { AdminConsultantOnboardingController } from '@modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller';
import { AdminConsultantSkillExamController } from '@modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller';
import { AdminOnboardingQuestionsController } from '@modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller';
import { BusinessOnboardingController } from '@modules/business-onboarding/controllers/business-onboarding.controller';
import { ConsultantOnboardingController } from '@modules/consultant-onboarding/controllers/consultant-onboarding.controller';
import { ConsultantSkillExamController } from '@modules/consultant-skill-exam/controllers/consultant-skill-exam.controller';
import { NotBannedGuard } from '@modules/consultant-skill-exam/guards/not-banned.guard';
import { OnboardingApprovedGuard } from '@modules/consultant-skill-exam/guards/onboarding-approved.guard';
import { BusinessProfilesController } from '@modules/profiles/business/business-profiles.controller';
import { BusinessProfilesAdminController } from '@modules/profiles/business/business-profiles-admin.controller';
import { ConsultantProfilesController } from '@modules/profiles/consultant/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from '@modules/profiles/consultant/consultant-profiles-admin.controller';
import { Module } from '@nestjs/common';

import { ProfilesClientsModule } from '@/clients/profiles';

import { GatewayHttpAuthModule } from '../shared/gateway-http-auth.module';
import {
  GatewayNotBannedGuard,
  GatewayOnboardingApprovedGuard,
} from '../shared/gateway-skill-exam.guards';
import { PROFILES_HTTP_PROVIDERS } from './profiles-http.providers';

@Module({
  imports: [ProfilesClientsModule, GatewayHttpAuthModule],
  controllers: [
    BusinessProfilesController,
    BusinessProfilesAdminController,
    ConsultantProfilesController,
    ConsultantProfilesAdminController,
    BusinessOnboardingController,
    ConsultantOnboardingController,
    AdminConsultantOnboardingController,
    AdminOnboardingQuestionsController,
    ConsultantSkillExamController,
    AdminConsultantSkillExamController,
  ],
  providers: [
    ...PROFILES_HTTP_PROVIDERS,
    { provide: NotBannedGuard, useClass: GatewayNotBannedGuard },
    { provide: OnboardingApprovedGuard, useClass: GatewayOnboardingApprovedGuard },
  ],
})
export class ProfilesHttpModule {}
