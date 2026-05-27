import { AdminConsultantOnboardingService } from '@modules/admin-consultant-onboarding/services/admin-consultant-onboarding.service';
import { AdminConsultantSkillExamService } from '@modules/admin-consultant-skill-exam/services/admin-consultant-skill-exam.service';
import { AdminOnboardingQuestionsService } from '@modules/admin-onboarding-questions/services/admin-onboarding-questions.service';
import { BusinessOnboardingService } from '@modules/business-onboarding/services/business-onboarding.service';
import { ConsultantOnboardingService } from '@modules/consultant-onboarding/services/consultant-onboarding.service';
import { OnboardingInterviewService } from '@modules/consultant-onboarding/services/onboarding-interview.service';
import { ConsultantSkillExamService } from '@modules/consultant-skill-exam/services/consultant-skill-exam.service';
import { BusinessProfilesService } from '@modules/profiles/business/business-profiles.service';
import { BusinessProfilesAdminService } from '@modules/profiles/business/business-profiles-admin.service';
import { ConsultantProfilesService } from '@modules/profiles/consultant/consultant-profiles.service';
import { ConsultantProfilesAdminService } from '@modules/profiles/consultant/consultant-profiles-admin.service';

import {
  AdminOnboardingClient,
  BusinessOnboardingClient,
  ConsultantOnboardingClient,
  ProfilesClient,
  SkillExamsClient,
} from '@/clients/profiles';
import { provideGrpcServiceProxy } from '@/http/shared/grpc-service-proxy.util';

export const PROFILES_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(BusinessProfilesService, ProfilesClient, 'businessProfiles'),
  provideGrpcServiceProxy(BusinessProfilesAdminService, ProfilesClient, 'businessProfilesAdmin'),
  provideGrpcServiceProxy(ConsultantProfilesService, ProfilesClient, 'consultantProfiles'),
  provideGrpcServiceProxy(
    ConsultantProfilesAdminService,
    ProfilesClient,
    'consultantProfilesAdmin',
  ),
  provideGrpcServiceProxy(
    BusinessOnboardingService,
    BusinessOnboardingClient,
    'businessOnboarding',
  ),
  provideGrpcServiceProxy(
    ConsultantOnboardingService,
    ConsultantOnboardingClient,
    'consultantOnboarding',
  ),
  provideGrpcServiceProxy(
    OnboardingInterviewService,
    ConsultantOnboardingClient,
    'consultantOnboarding',
    {
      getQuestions: 'consultantOnboarding.getQuestions',
      submitAnswers: 'consultantOnboarding.submitInterview',
    },
  ),
  provideGrpcServiceProxy(
    AdminConsultantOnboardingService,
    AdminOnboardingClient,
    'adminConsultantOnboarding',
  ),
  provideGrpcServiceProxy(
    AdminOnboardingQuestionsService,
    AdminOnboardingClient,
    'adminOnboardingQuestions',
  ),
  provideGrpcServiceProxy(ConsultantSkillExamService, SkillExamsClient, 'consultantSkillExam'),
  provideGrpcServiceProxy(
    AdminConsultantSkillExamService,
    SkillExamsClient,
    'adminConsultantSkillExam',
  ),
];
