import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessProfile } from '@database/entities';
import { NOTIFICATION_TYPES } from '@modules/notifications/enums/notification-type.enum';
import { NotificationDispatcherService } from '@modules/notifications/services/notification-dispatcher.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
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
    const existing = await this.uow.businessProfiles.findByUserId(userId);

    if (existing) {
      this.logger.warn(`onboard — profile already exists | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.already_exists',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_ALREADY_EXISTS,
        status: HttpStatus.CONFLICT,
      });
    }

    const profile = this.uow.businessProfiles.create({
      userId,
      companyName: dto.company_name,
      industry: dto.industry,
      companySize: dto.company_size,
      addressLine: dto.address_line,
      city: dto.city,
      stateProvince: dto.state_province,
      postalCode: dto.postal_code,
      countryCode: dto.country_code,
      phoneNumber: dto.phone_number,
    });
    await this.uow.businessProfiles.save(profile);

    // TypeORM may omit boolean columns that carry a @Column({ default }) from
    // the INSERT, relying on the DB default (false). Use an explicit UPDATE so
    // is_verified = true is guaranteed to be written, then reload the canonical row.
    await this.uow.businessProfiles.update(profile.id, { isVerified: true });
    const saved = await this.uow.businessProfiles.findByActiveId(profile.id);

    this.logger.log(`onboard — complete | userId: ${userId}, profileId: ${profile.id}`);
    return this.toResponseDto(saved!);
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
