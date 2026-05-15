import { ERROR_CODES } from '@common/constants/error-codes';
import { NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { BusinessProfile } from '@database/entities';
import { BusinessProfileResponseDto } from '@modules/profiles/business/dto/responses/business-profile-response.dto';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { OnboardBusinessProfileDto } from '../dto/requests/onboard-business-profile.dto';
import { IBusinessOnboardingService } from '../interfaces/business-onboarding.service.interface';

@Injectable()
export class BusinessOnboardingService implements IBusinessOnboardingService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(BusinessOnboardingService.name, requestContext);
  }

  /** @inheritdoc */
  public async onboard(dto: OnboardBusinessProfileDto): Promise<BusinessProfileResponseDto> {
    const userId = this.requestContext.userId!;
    // Platform is enforced by PlatformGuard at the controller layer (BUSINESS only),
    // so this is non-null when the handler executes.
    const platform = this.requestContext.activePlatform!;
    this.logger.log(
      `[${this.rid}] onboard — start | userId: ${userId}, company: ${dto.company_name}, country: ${dto.country_code}`,
    );

    const profile = await this.uow.businessProfiles.findByUserId(userId);
    if (!profile) {
      this.logger.warn(`[${this.rid}] onboard — profile stub not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const conflict = await this.uow.businessProfiles.existsTaxIdConflict({
      taxId: dto.tax_id,
      countryCode: dto.country_code,
      platform,
      excludeUserId: userId,
    });
    if (conflict) {
      this.logger.warn(
        `[${this.rid}] onboard — tax_id conflict | userId: ${userId}, country: ${dto.country_code}`,
      );
      throw new TranslatableException({
        messageKey: 'error.business_profile.tax_id_already_exists',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS,
        status: HttpStatus.CONFLICT,
      });
    }

    profile.companyName = dto.company_name;
    profile.ownerName = dto.owner_name;
    profile.taxId = dto.tax_id;
    profile.industry = dto.industry;
    profile.companySize = dto.company_size;
    profile.addressLine = dto.address_line;
    profile.city = dto.city;
    profile.stateProvince = dto.state_province;
    profile.postalCode = dto.postal_code;
    profile.countryCode = dto.country_code;
    profile.phoneNumber = dto.phone_number;
    // Persist client-supplied tz when valid; otherwise fall back to the
    // request-context value (already validated against Intl.DateTimeFormat by
    // RequestContextMiddleware.resolveTimezone). Null when neither is present.
    profile.timezone =
      dto.timezone && DateUtil.isValidTimezone(dto.timezone)
        ? dto.timezone
        : this.requestContext.timezone;
    profile.isVerified = true;

    await this.uow.businessProfiles.save(profile);

    this.eventEmitter.emit(NOTIFICATION_EVENTS.BUSINESS_ONBOARDED, {
      business_user_id: userId,
      business_id: profile.id,
      business_name: profile.companyName ?? '',
    });

    this.logger.log(
      `[${this.rid}] onboard — complete | userId: ${userId}, profileId: ${profile.id}`,
    );
    return this.toResponseDto(profile);
  }

  private toResponseDto(profile: BusinessProfile): BusinessProfileResponseDto {
    return plainToInstance(BusinessProfileResponseDto, profile, { excludeExtraneousValues: true });
  }
}
