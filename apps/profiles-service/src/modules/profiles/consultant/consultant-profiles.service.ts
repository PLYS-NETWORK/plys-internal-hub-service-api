import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { UrlResolverService } from '@plys/libraries/common-nest/modules/file-storage';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ConsultantProfile, ConsultantSkill } from '@plys/libraries/database/entities';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ConsultantSkillsService } from './consultant-skills.service';
import { UpdateConsultantProfileDto } from './dto/requests';
import { ConsultantProfileResponseDto } from './dto/responses';
import { IConsultantProfilesService } from './interfaces/consultant-profiles-service.interface';

@Injectable()
export class ConsultantProfilesService implements IConsultantProfilesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly consultantSkillsService: ConsultantSkillsService,
    private readonly urlResolver: UrlResolverService,
  ) {
    this.logger = new AppLogger(ConsultantProfilesService.name, requestContext);
  }

  /** @inheritdoc */
  public async getProfile(): Promise<ConsultantProfileResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`getProfile — start | userId: ${userId}`);
    const profile = await this.uow.consultantProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`getProfile — profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const skills = await this.consultantSkillsService.findByConsultantId(profile.id);
    this.logger.log(`getProfile — complete | userId: ${userId}, skills: ${skills.length}`);
    return await this.toResponseDto(profile, skills);
  }

  /** @inheritdoc */
  public async updateProfile(
    dto: UpdateConsultantProfileDto,
  ): Promise<ConsultantProfileResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`updateProfile — start | userId: ${userId}`);
    const profile = await this.uow.consultantProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`updateProfile — profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [updatedProfile, skills] = await this.uow.withTransaction(async (txUow) => {
      if (dto.full_name !== undefined) profile.fullName = dto.full_name;
      if (dto.bio !== undefined) profile.bio = dto.bio;
      if (dto.years_of_experience !== undefined)
        profile.yearsOfExperience = dto.years_of_experience;
      if (dto.address_line !== undefined) profile.addressLine = dto.address_line;
      if (dto.city !== undefined) profile.city = dto.city;
      if (dto.state_province !== undefined) profile.stateProvince = dto.state_province;
      if (dto.postal_code !== undefined) profile.postalCode = dto.postal_code;
      if (dto.country_code !== undefined) profile.countryCode = dto.country_code;
      if (dto.phone_number !== undefined) profile.phoneNumber = dto.phone_number;

      const savedProfile = await txUow.consultantProfiles.save(profile);

      const currentSkills =
        dto.skills !== undefined
          ? await this.consultantSkillsService.replaceForConsultant(
              savedProfile.id,
              dto.skills,
              txUow,
            )
          : await this.consultantSkillsService.findByConsultantId(savedProfile.id, txUow);

      return [savedProfile, currentSkills] as const;
    });

    this.logger.log(
      `updateProfile — complete | userId: ${userId}, profileId: ${updatedProfile.id}, skills: ${skills.length}`,
    );
    return await this.toResponseDto(updatedProfile, skills);
  }

  private async toResponseDto(
    profile: ConsultantProfile,
    skills: ConsultantSkill[],
  ): Promise<ConsultantProfileResponseDto> {
    const avatarUrl = await this.urlResolver.resolve(profile.avatarUrl);
    return plainToInstance(
      ConsultantProfileResponseDto,
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
      },
      { excludeExtraneousValues: true },
    );
  }
}
