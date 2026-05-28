import { HttpStatus, Injectable } from '@nestjs/common';
import { NOTIFICATION_TYPES } from '@plys/libraries/api-contracts/notifications/enums/notification-type.enum';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientService } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { BusinessProfile } from '@plys/libraries/database/entities';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../errors/error-codes';
import { UpdateBusinessProfileDto } from './dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from './dto/responses/business-profile-response.dto';
import { IBusinessProfilesService } from './interfaces/business-profiles-service.interface';

@Injectable()
export class BusinessProfilesService implements IBusinessProfilesService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly notificationsClient: NotificationsClientService,
  ) {
    this.logger = new AppLogger(BusinessProfilesService.name, requestContext);
  }

  /** @inheritdoc */
  public async getProfile(): Promise<BusinessProfileResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getProfile — start | userId: ${userId}`);
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`[${this.rid}] getProfile — profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return this.toResponseDto(profile);
  }

  /** @inheritdoc */
  public async updateProfile(dto: UpdateBusinessProfileDto): Promise<BusinessProfileResponseDto> {
    const userId = this.requestContext.userId!;
    const platform = this.requestContext.activePlatform!;
    this.logger.log(`[${this.rid}] updateProfile — start | userId: ${userId}`);
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`[${this.rid}] updateProfile — profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Apply country_code first because the tax_id uniqueness check pairs the
    // new tax_id with whatever country the profile will end up at.
    const updatedFields: string[] = [];
    if (dto.company_name !== undefined) {
      profile.companyName = dto.company_name;
      updatedFields.push('company_name');
    }
    if (dto.owner_name !== undefined) {
      profile.ownerName = dto.owner_name;
      updatedFields.push('owner_name');
    }
    if (dto.industry !== undefined) {
      profile.industry = dto.industry;
      updatedFields.push('industry');
    }
    if (dto.company_size !== undefined) {
      profile.companySize = dto.company_size;
      updatedFields.push('company_size');
    }
    if (dto.address_line !== undefined) {
      profile.addressLine = dto.address_line;
      updatedFields.push('address_line');
    }
    if (dto.city !== undefined) {
      profile.city = dto.city;
      updatedFields.push('city');
    }
    if (dto.state_province !== undefined) {
      profile.stateProvince = dto.state_province;
      updatedFields.push('state_province');
    }
    if (dto.postal_code !== undefined) {
      profile.postalCode = dto.postal_code;
      updatedFields.push('postal_code');
    }
    if (dto.country_code !== undefined) {
      profile.countryCode = dto.country_code;
      updatedFields.push('country_code');
    }
    if (dto.phone_number !== undefined) {
      profile.phoneNumber = dto.phone_number;
      updatedFields.push('phone_number');
    }

    if (dto.tax_id !== undefined && dto.tax_id !== profile.taxId) {
      // `profile.countryCode` already reflects the requested change above, so
      // the conflict scan pairs the new tax_id with the *new* country.
      if (!profile.countryCode) {
        this.logger.warn(
          `[${this.rid}] updateProfile — tax_id supplied without country | userId: ${userId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.business_profile.tax_id_already_exists',
          errorCode: ERROR_CODES.BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS,
          status: HttpStatus.CONFLICT,
        });
      }
      const conflict = await this.uow.businessProfiles.existsTaxIdConflict({
        taxId: dto.tax_id,
        countryCode: profile.countryCode,
        platform,
        excludeUserId: userId,
      });
      if (conflict) {
        this.logger.warn(
          `[${this.rid}] updateProfile — tax_id conflict | userId: ${userId}, country: ${profile.countryCode}`,
        );
        throw new TranslatableException({
          messageKey: 'error.business_profile.tax_id_already_exists',
          errorCode: ERROR_CODES.BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS,
          status: HttpStatus.CONFLICT,
        });
      }
      profile.taxId = dto.tax_id;
      updatedFields.push('tax_id');
    }

    await this.uow.businessProfiles.save(profile);

    // Fire-and-forget — never blocks the request, never throws back to the caller.
    if (updatedFields.length > 0) {
      this.notificationsClient.dispatch({
        userId,
        type: NOTIFICATION_TYPES.PROFILE_UPDATED,
        metadata: { updated_fields: updatedFields },
        actorId: userId,
      });
    }

    this.logger.log(
      `[${this.rid}] updateProfile — complete | userId: ${userId}, profileId: ${profile.id}`,
    );
    return this.toResponseDto(profile);
  }

  private toResponseDto(profile: BusinessProfile): BusinessProfileResponseDto {
    // `logo_url` is a manually-curated CDN URL — not an S3 upload — so no
    // re-signing is needed here.
    return plainToInstance(BusinessProfileResponseDto, profile, { excludeExtraneousValues: true });
  }
}
