import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantProfile, ConsultantSkill } from '@database/entities';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ConsultantSkillsService } from './consultant-skills.service';
import { OnboardConsultantProfileDto, UpdateConsultantProfileDto } from './dto/requests';
import { ConsultantProfileResponseDto } from './dto/responses';
import { IConsultantProfilesService } from './interfaces/consultant-profiles-service.interface';

@Injectable()
export class ConsultantProfilesService implements IConsultantProfilesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly consultantSkillsService: ConsultantSkillsService,
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
    return this.toResponseDto(profile, skills);
  }

  /** @inheritdoc */
  public async onboard(dto: OnboardConsultantProfileDto): Promise<ConsultantProfileResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`onboard — start | userId: ${userId}, fullName: ${dto.full_name}`);
    const existing = await this.uow.consultantProfiles.findByUserId(userId);

    if (existing) {
      this.logger.warn(`onboard — profile already exists | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.already_exists',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_ALREADY_EXISTS,
        status: HttpStatus.CONFLICT,
      });
    }

    const [profile, skills] = await this.uow.withTransaction(async (txUow) => {
      const newProfile = txUow.consultantProfiles.create({
        userId,
        fullName: dto.full_name,
        bio: dto.bio ?? null,
        yearsOfExperience: dto.years_of_experience ?? null,
        availability: (dto.availability as ConsultantProfile['availability']) ?? null,
        addressLine: dto.address_line ?? null,
        city: dto.city ?? null,
        stateProvince: dto.state_province ?? null,
        postalCode: dto.postal_code ?? null,
        countryCode: dto.country_code ?? null,
        phoneNumber: dto.phone_number ?? null,
        isVerified: false,
      });
      const savedProfile = await txUow.consultantProfiles.save(newProfile);
      const savedSkills = await this.consultantSkillsService.createForConsultant(
        savedProfile.id,
        dto.skills ?? [],
        txUow,
      );
      return [savedProfile, savedSkills] as const;
    });

    this.logger.log(
      `onboard — complete | userId: ${userId}, profileId: ${profile.id}, skills: ${skills.length}`,
    );
    return this.toResponseDto(profile, skills);
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
      if (dto.availability !== undefined)
        profile.availability = dto.availability as ConsultantProfile['availability'];
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
    return this.toResponseDto(updatedProfile, skills);
  }

  private toResponseDto(
    profile: ConsultantProfile,
    skills: ConsultantSkill[],
  ): ConsultantProfileResponseDto {
    return plainToInstance(
      ConsultantProfileResponseDto,
      {
        id: profile.id,
        userId: profile.userId,
        fullName: profile.fullName,
        bio: profile.bio,
        yearsOfExperience: profile.yearsOfExperience,
        availability: profile.availability,
        avatarUrl: profile.avatarUrl,
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
