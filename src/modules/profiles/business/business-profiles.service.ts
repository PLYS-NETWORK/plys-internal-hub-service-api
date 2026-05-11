import { ERROR_CODES } from '@common/constants/error-codes';
import { NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessProfile } from '@database/entities';
import { NOTIFICATION_TYPES } from '@modules/notifications/enums/notification-type.enum';
import { NotificationDispatcherService } from '@modules/notifications/services/notification-dispatcher.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { OnboardBusinessProfileDto } from './dto/requests/onboard-business-profile.dto';
import { UpdateBusinessProfileDto } from './dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from './dto/responses/business-profile-response.dto';
import { IBusinessProfilesService } from './interfaces/business-profiles-service.interface';

@Injectable()
export class BusinessProfilesService implements IBusinessProfilesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(BusinessProfilesService.name, requestContext);
  }

  /** @inheritdoc */
  public async getProfile(): Promise<BusinessProfileResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`getProfile — start | userId: ${userId}`);
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`getProfile — profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return this.toResponseDto(profile);
  }

  /** @inheritdoc */
  public async onboard(dto: OnboardBusinessProfileDto): Promise<BusinessProfileResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`onboard — start | userId: ${userId}, company: ${dto.company_name}`);

    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`onboard — profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    profile.companyName = dto.company_name;
    profile.industry = dto.industry;
    profile.companySize = dto.company_size;
    profile.addressLine = dto.address_line;
    profile.city = dto.city;
    profile.stateProvince = dto.state_province;
    profile.postalCode = dto.postal_code;
    profile.countryCode = dto.country_code;
    profile.phoneNumber = dto.phone_number;
    profile.isVerified = true;

    await this.uow.businessProfiles.save(profile);

    this.eventEmitter.emit(NOTIFICATION_EVENTS.BUSINESS_ONBOARDED, {
      business_user_id: userId,
      business_id: profile.id,
      business_name: profile.companyName ?? '',
    });

    this.logger.log(`onboard — complete | userId: ${userId}, profileId: ${profile.id}`);
    return this.toResponseDto(profile);
  }

  /** @inheritdoc */
  public async updateProfile(dto: UpdateBusinessProfileDto): Promise<BusinessProfileResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`updateProfile — start | userId: ${userId}`);
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`updateProfile — profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Only update fields that are explicitly present in the payload — also
    // collected as a `updated_fields` list for the notification metadata.
    const updatedFields: string[] = [];
    if (dto.company_name !== undefined) {
      profile.companyName = dto.company_name;
      updatedFields.push('company_name');
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

    await this.uow.businessProfiles.save(profile);

    // Fire-and-forget — never blocks the request, never throws back to the caller.
    if (updatedFields.length > 0) {
      void this.notificationDispatcher
        .dispatch({
          userId,
          type: NOTIFICATION_TYPES.PROFILE_UPDATED,
          metadata: { updated_fields: updatedFields },
          actorId: userId,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`updateProfile — notification dispatch failed | error: ${msg}`);
        });
    }

    this.logger.log(`updateProfile — complete | userId: ${userId}, profileId: ${profile.id}`);
    return this.toResponseDto(profile);
  }

  private toResponseDto(profile: BusinessProfile): BusinessProfileResponseDto {
    return plainToInstance(BusinessProfileResponseDto, profile, { excludeExtraneousValues: true });
  }
}
