import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { OnboardingStatus } from '@plys/libraries/database/enums';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';

export async function assertSkillExamUserNotBanned(
  uow: ProfilesUnitOfWorkService,
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) {
    throw new TranslatableException({
      messageKey: 'error.skill_exam.user_banned',
      errorCode: ERROR_CODES.SKILL_EXAM_USER_BANNED,
      status: HttpStatus.FORBIDDEN,
    });
  }
  const user = await uow.users.findById(userId);
  if (!user || user.bannedAt !== null) {
    throw new TranslatableException({
      messageKey: 'error.skill_exam.user_banned',
      errorCode: ERROR_CODES.SKILL_EXAM_USER_BANNED,
      status: HttpStatus.FORBIDDEN,
      details: { ban_reason: user?.banReason ?? null },
    });
  }
}

export async function assertConsultantOnboardingApproved(
  uow: ProfilesUnitOfWorkService,
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) {
    throw new TranslatableException({
      messageKey: 'error.consultant_onboarding.not_approved',
      errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_APPROVED,
      status: HttpStatus.FORBIDDEN,
    });
  }
  const onboarding = await uow.consultantOnboardings.findByUserId(userId);
  if (!onboarding || onboarding.status !== OnboardingStatus.APPROVED) {
    throw new TranslatableException({
      messageKey: 'error.consultant_onboarding.not_approved',
      errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_APPROVED,
      status: HttpStatus.FORBIDDEN,
    });
  }
}

export async function assertSkillExamAccessAllowed(
  uow: ProfilesUnitOfWorkService,
  userId: string,
): Promise<void> {
  await assertSkillExamUserNotBanned(uow, userId);
  await assertConsultantOnboardingApproved(uow, userId);
}
