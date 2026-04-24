import { ActivePlatform } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { Injectable } from '@nestjs/common';

import { RegisterDto } from '../dto/requests/register.dto';
import { IUserOnboardingService } from '../interfaces/auth-service.interface';

/**
 * UserOnboardingService is responsible for creating the platform-specific
 * minimum-viable profile after a user account is first created.
 *
 * Shared by BasicAuthService (email/password registration) and
 * SsoAuthService (first SSO login) to avoid duplication — SRP.
 */
@Injectable()
export class UserOnboardingService implements IUserOnboardingService {
  /**
   * Creates the minimum-viable profile row for the user's platform.
   * - BUSINESS   → business_profiles with company_name
   * - CONSULTANT → consultant_profiles with full_name
   * - ADMIN      → no profile row (admins have no consumer-facing profile)
   *
   * @returns the display name for downstream use (email greeting, etc.)
   */
  public async createInitialProfile(
    tx: IUnitOfWork,
    userId: string,
    dto: Pick<RegisterDto, 'active_platform' | 'company_name' | 'full_name'>,
  ): Promise<string> {
    if (dto.active_platform === ActivePlatform.BUSINESS) {
      const companyName = dto.company_name!;
      const profile = tx.businessProfiles.create({
        userId,
        companyName,
        isVerified: false,
      });
      await tx.businessProfiles.save(profile);
      return companyName;
    }

    if (dto.active_platform === ActivePlatform.CONSULTANT) {
      const fullName = dto.full_name!;
      const profile = tx.consultantProfiles.create({
        userId,
        fullName,
        isVerified: false,
      });
      await tx.consultantProfiles.save(profile);
      return fullName;
    }

    // ADMIN — no profile row; fall back to a generic greeting.
    return 'Admin';
  }
}
