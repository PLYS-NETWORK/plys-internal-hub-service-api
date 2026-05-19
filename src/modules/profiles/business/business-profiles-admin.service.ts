import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { Order } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessProfile } from '@database/entities';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  AdminBusinessProfileSortable,
  ListBusinessProfilesDto,
} from './dto/requests/list-business-profiles.dto';
import { AdminBusinessProfileDetailResponseDto } from './dto/responses/admin-business-profile-detail-response.dto';
import { AdminBusinessProfileListItemResponseDto } from './dto/responses/admin-business-profile-list-item-response.dto';
import { IBusinessProfilesAdminService } from './interfaces/business-profiles-admin-service.interface';

// Maps the public `sort_by` token to the entity column expression used in
// ORDER BY. Whitelisted up-front so a user-supplied value never reaches SQL.
const SORT_COLUMN_MAP: Record<AdminBusinessProfileSortable, string> = {
  created_at: 'bp.createdAt',
  updated_at: 'bp.updatedAt',
  company_name: 'bp.companyName',
};

@Injectable()
export class BusinessProfilesAdminService implements IBusinessProfilesAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BusinessProfilesAdminService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(
    filters: ListBusinessProfilesDto,
  ): Promise<PageDto<AdminBusinessProfileListItemResponseDto>> {
    this.logger.log(
      `list — start | page: ${filters.page}, limit: ${filters.limit}, ` +
        `is_partner_platform: ${filters.isPartnerPlatform ?? '<any>'}, ` +
        `is_verified: ${filters.isVerified ?? '<any>'}`,
    );

    const sortKey: AdminBusinessProfileSortable = filters.sort_by ?? 'created_at';
    const direction: Order = filters.order_by ?? Order.DESC;

    const qb = this.uow.businessProfiles
      .createQueryBuilder('bp')
      .leftJoinAndSelect('bp.user', 'u')
      .where('bp.deleted_at IS NULL');

    if (filters.isPartnerPlatform !== undefined) {
      qb.andWhere('bp.is_partner_platform = :ipp', { ipp: filters.isPartnerPlatform });
    }
    if (filters.isVerified !== undefined) {
      qb.andWhere('bp.is_verified = :iv', { iv: filters.isVerified });
    }

    const [rows, itemCount] = await qb
      .orderBy(SORT_COLUMN_MAP[sortKey], direction)
      // Tie-break on id so successive pages stay stable when the chosen
      // sort key has duplicates (e.g. many rows with the same created_at
      // truncated to the same second on bulk imports).
      .addOrderBy('bp.id', 'ASC')
      .skip(filters.skip)
      .take(filters.limit)
      .getManyAndCount();

    const data = rows.map((row) => this.toListItemDto(row));
    const meta = new PageMetaDto({ pageOptionsDto: filters, itemCount });

    this.logger.log(`list — complete | returned: ${data.length}, total: ${itemCount}`);
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async getById(id: string): Promise<AdminBusinessProfileDetailResponseDto> {
    this.logger.log(`getById — start | id: ${id}`);
    const profile = await this.uow.businessProfiles
      .createQueryBuilder('bp')
      .leftJoinAndSelect('bp.user', 'u')
      .where('bp.id = :id', { id })
      .andWhere('bp.deleted_at IS NULL')
      .getOne();

    if (!profile) {
      this.logger.warn(`getById — profile not found | id: ${id}`);
      throw this.profileNotFound();
    }

    return this.toDetailDto(profile);
  }

  /** @inheritdoc */
  public async setPartnerPlatform(id: string, value: boolean): Promise<void> {
    this.logger.log(`setPartnerPlatform — start | id: ${id}, value: ${value}`);
    const profile = await this.loadActiveOrThrow(id);
    profile.isPartnerPlatform = value;
    await this.uow.businessProfiles.save(profile);
    this.logger.log(`setPartnerPlatform — complete | id: ${id}, value: ${value}`);
  }

  /** @inheritdoc */
  public async setAllowPaymentCredit(id: string, value: boolean): Promise<void> {
    this.logger.log(`setAllowPaymentCredit — start | id: ${id}, value: ${value}`);
    const profile = await this.loadActiveOrThrow(id);
    profile.allowPaymentCredit = value;
    await this.uow.businessProfiles.save(profile);
    this.logger.log(`setAllowPaymentCredit — complete | id: ${id}, value: ${value}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async loadActiveOrThrow(id: string): Promise<BusinessProfile> {
    const profile = await this.uow.businessProfiles.findByActiveId(id);
    if (!profile) {
      this.logger.warn(`loadActiveOrThrow — profile not found | id: ${id}`);
      throw this.profileNotFound();
    }
    return profile;
  }

  private profileNotFound(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.business_profile.not_found',
      errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private toListItemDto(profile: BusinessProfile): AdminBusinessProfileListItemResponseDto {
    return plainToInstance(
      AdminBusinessProfileListItemResponseDto,
      {
        id: profile.id,
        user_id: profile.userId,
        company_name: profile.companyName,
        tax_id: profile.taxId,
        email: profile.user.email,
        phone_number: profile.phoneNumber,
        address_line: profile.addressLine,
        city: profile.city,
        state_province: profile.stateProvince,
        postal_code: profile.postalCode,
        country_code: profile.countryCode,
        is_partner_platform: profile.isPartnerPlatform,
        allow_payment_credit: profile.allowPaymentCredit,
        is_verified: profile.isVerified,
        register_date: profile.user.createdAt,
        last_login: profile.user.lastLoginAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toDetailDto(profile: BusinessProfile): AdminBusinessProfileDetailResponseDto {
    // `logo_url` is a manually-curated CDN URL — not an S3 upload — so it is
    // passed through verbatim and not re-signed.
    return plainToInstance(
      AdminBusinessProfileDetailResponseDto,
      {
        // Keep camelCase keys here — the parent BusinessProfileResponseDto
        // declares `@Expose({ name: 'companyName' })` etc., so the source
        // shape mirrors the entity exactly.
        ...profile,
        email: profile.user.email,
        register_date: profile.user.createdAt,
        last_login: profile.user.lastLoginAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
