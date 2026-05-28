import { HttpStatus, Injectable } from '@nestjs/common';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageMetaDto } from '@plys/libraries/common-nest/dto/page-meta.dto';
import { Order } from '@plys/libraries/common-nest/dto/page-options.dto';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { UrlResolverService } from '@plys/libraries/common-nest/modules/file-storage';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ConsultantProfile, ConsultantSkill } from '@plys/libraries/database/entities';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../errors/error-codes';
import { ConsultantSkillsService } from './consultant-skills.service';
import {
  AdminConsultantProfileSortable,
  ListConsultantProfilesAdminDto,
} from './dto/requests/list-consultant-profiles-admin.dto';
import { AdminConsultantProfileDetailResponseDto } from './dto/responses/admin-consultant-profile-detail-response.dto';
import { AdminConsultantProfileListItemResponseDto } from './dto/responses/admin-consultant-profile-list-item-response.dto';
import { IConsultantProfilesAdminService } from './interfaces/consultant-profiles-admin-service.interface';

// Maps the public `sort_by` token to the entity column expression used in
// ORDER BY. Whitelisted up-front so a user-supplied value never reaches SQL.
const SORT_COLUMN_MAP: Record<AdminConsultantProfileSortable, string> = {
  created_at: 'cp.createdAt',
  updated_at: 'cp.updatedAt',
  full_name: 'cp.fullName',
};

@Injectable()
export class ConsultantProfilesAdminService implements IConsultantProfilesAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly consultantSkillsService: ConsultantSkillsService,
    private readonly urlResolver: UrlResolverService,
  ) {
    this.logger = new AppLogger(ConsultantProfilesAdminService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(
    filters: ListConsultantProfilesAdminDto,
  ): Promise<PageDto<AdminConsultantProfileListItemResponseDto>> {
    this.logger.log(
      `list — start | page: ${filters.page}, limit: ${filters.limit}, ` +
        `has_notification_priority: ${filters.hasNotificationPriority ?? '<any>'}`,
    );

    const sortKey: AdminConsultantProfileSortable = filters.sort_by ?? 'created_at';
    const direction: Order = filters.order_by ?? Order.DESC;

    const qb = this.uow.consultantProfiles
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.user', 'u')
      .where('cp.deleted_at IS NULL')
      // Hard filter: list returns only onboarding-approved consultants. The
      // approval flow atomically sets `is_verified = true` when an admin
      // moves `consultant_onboardings.status` to `APPROVED`, so this column
      // is the cheapest single-table proxy for "approved".
      .andWhere('cp.is_verified = TRUE');

    if (filters.hasNotificationPriority !== undefined) {
      qb.andWhere('cp.has_notification_priority = :hnp', {
        hnp: filters.hasNotificationPriority,
      });
    }

    const [rows, itemCount] = await qb
      .orderBy(SORT_COLUMN_MAP[sortKey], direction)
      // Tie-break on id so successive pages stay stable when the chosen
      // sort key has duplicates (e.g. many rows with the same created_at
      // truncated to the same second on bulk imports).
      .addOrderBy('cp.id', 'ASC')
      .skip(filters.skip)
      .take(filters.limit)
      .getManyAndCount();

    // Re-presign avatar_url for every row in parallel — the stored values are
    // upload-time presigned URLs with a short TTL and would 403 if served raw.
    const resolvedAvatars = await this.urlResolver.resolveMany(rows.map((r) => r.avatarUrl));
    const data = rows.map((row, i) => this.toListItemDto(row, resolvedAvatars[i]));
    const meta = new PageMetaDto({ pageOptionsDto: filters, itemCount });

    this.logger.log(`list — complete | returned: ${data.length}, total: ${itemCount}`);
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async getById(id: string): Promise<AdminConsultantProfileDetailResponseDto> {
    this.logger.log(`getById — start | id: ${id}`);
    const profile = await this.uow.consultantProfiles
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.user', 'u')
      .where('cp.id = :id', { id })
      .andWhere('cp.deleted_at IS NULL')
      .getOne();

    if (!profile) {
      this.logger.warn(`getById — profile not found | id: ${id}`);
      throw this.profileNotFound();
    }

    const [skills, avatarUrl, cvUrl] = await Promise.all([
      this.consultantSkillsService.findByConsultantId(profile.id),
      this.urlResolver.resolve(profile.avatarUrl),
      this.urlResolver.resolve(profile.cvUrl),
    ]);

    this.logger.log(`getById — complete | id: ${id}, skills: ${skills.length}`);
    return this.toDetailDto(profile, skills, avatarUrl, cvUrl);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private profileNotFound(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.consultant_profile.not_found',
      errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private toListItemDto(
    profile: ConsultantProfile,
    avatarUrl: string | null,
  ): AdminConsultantProfileListItemResponseDto {
    return plainToInstance(
      AdminConsultantProfileListItemResponseDto,
      {
        id: profile.id,
        user_id: profile.userId,
        full_name: profile.fullName,
        avatar_url: avatarUrl,
        email: profile.user.email,
        phone_number: profile.phoneNumber,
        city: profile.city,
        country_code: profile.countryCode,
        years_of_experience: profile.yearsOfExperience,
        is_verified: profile.isVerified,
        has_notification_priority: profile.hasNotificationPriority,
        avg_rating: profile.avgRating,
        register_date: profile.user.createdAt,
        last_login: profile.user.lastLoginAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toDetailDto(
    profile: ConsultantProfile,
    skills: ConsultantSkill[],
    avatarUrl: string | null,
    cvUrl: string | null,
  ): AdminConsultantProfileDetailResponseDto {
    // The parent `ConsultantProfileResponseDto` declares its exposures with
    // `@Expose({ name: 'camelCaseKey' })`, so the source object must use
    // camelCase keys for those fields. The admin-only additions
    // (cv_url, stripe_connect_account_id, has_notification_priority,
    // avg_rating, email, register_date, last_login) use `@Expose()` with no
    // rename, so they read straight from snake_case source keys.
    return plainToInstance(
      AdminConsultantProfileDetailResponseDto,
      {
        id: profile.id,
        userId: profile.userId,
        fullName: profile.fullName,
        bio: profile.bio,
        yearsOfExperience: profile.yearsOfExperience,
        avatarUrl,
        addressLine: profile.addressLine,
        city: profile.city,
        stateProvince: profile.stateProvince,
        postalCode: profile.postalCode,
        countryCode: profile.countryCode,
        phoneNumber: profile.phoneNumber,
        isVerified: profile.isVerified,
        accountBalance: profile.accountBalance,
        createdAt: profile.createdAt,
        skills: skills.map((s) => ({
          skill_id: s.skillId,
          proficiency_level: s.proficiencyLevel,
          rating: s.rating,
        })),
        cv_url: cvUrl,
        stripe_connect_account_id: profile.stripeConnectAccountId,
        has_notification_priority: profile.hasNotificationPriority,
        avg_rating: profile.avgRating,
        email: profile.user.email,
        register_date: profile.user.createdAt,
        last_login: profile.user.lastLoginAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
