import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantApplication } from '@database/entities';
import { ApplicationStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { InjectQueue } from '@nestjs/bull';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { plainToInstance } from 'class-transformer';

import {
  CONSULTANT_APPLICATION_JOBS,
  CONSULTANT_APPLICATION_QUEUE,
} from '../consultant-application.constants';
import { SubmitProfileDto } from '../dto/requests/submit-profile.dto';
import { ApplicationStatusResponseDto } from '../dto/responses/application-status-response.dto';
import { IConsultantApplicationService } from '../interfaces/consultant-application.service.interface';

@Injectable()
export class ConsultantApplicationService implements IConsultantApplicationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    @InjectQueue(CONSULTANT_APPLICATION_QUEUE)
    private readonly queue: Queue,
  ) {
    this.logger = new AppLogger(ConsultantApplicationService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async getMyApplicationStatus(): Promise<ApplicationStatusResponseDto | null> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getMyApplicationStatus — start | userId: ${userId}`);

    const application = await this.uow.consultantApplications.findLatestByUserId(userId);
    if (!application) {
      return null;
    }

    return this.toStatusDto(application);
  }

  /** @inheritdoc */
  public async submitProfile(dto: SubmitProfileDto): Promise<ApplicationStatusResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] submitProfile — start | userId: ${userId}`);

    const application = await this.uow.withTransaction(async (tx) => {
      // Block check
      const latest = await tx.consultantApplications.findLatestByUserId(userId);
      if (latest?.blockedUntil && latest.blockedUntil > new Date()) {
        this.logger.warn(
          `[${this.rid}] submitProfile — blocked | userId: ${userId}, until: ${latest.blockedUntil.toISOString()}`,
        );
        throw new TranslatableException({
          messageKey: 'error.consultant_application.blocked',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_BLOCKED,
          status: HttpStatus.FORBIDDEN,
          details: { blocked_until: latest.blockedUntil.toISOString() },
        });
      }

      // Find or create application
      let app = await tx.consultantApplications.findActiveByUserId(userId);

      if (app && app.status !== ApplicationStatus.PENDING_PROFILE) {
        this.logger.warn(
          `[${this.rid}] submitProfile — invalid status | userId: ${userId}, status: ${app.status}`,
        );
        throw new TranslatableException({
          messageKey: 'error.consultant_application.invalid_status',
          errorCode: ERROR_CODES.CONSULTANT_APPLICATION_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      if (!app) {
        app = tx.consultantApplications.create({
          userId,
          status: ApplicationStatus.PENDING_PROFILE,
        }) as ConsultantApplication;
      }

      app.status = ApplicationStatus.GENERATING_QUESTIONS;
      app.profileSubmittedAt = new Date();
      const saved = await tx.consultantApplications.save(app);

      // Update consultant profile fields
      const profile = await tx.consultantProfiles.findByUserId(userId);
      if (profile) {
        profile.bio = dto.bio;
        profile.yearsOfExperience = dto.yearsOfExperience;
        await tx.consultantProfiles.save(profile);
      }

      // Replace consultant skills: delete existing, insert new
      if (profile) {
        await tx.consultantSkills.delete({ consultantId: profile.id });
        for (const skillId of dto.skillIds) {
          const consultantSkill = tx.consultantSkills.create({
            consultantId: profile.id,
            skillId,
          });
          await tx.consultantSkills.save(consultantSkill);
        }
      }

      return saved;
    });

    // Dispatch background job outside of transaction to avoid holding the connection
    await this.queue.add(
      CONSULTANT_APPLICATION_JOBS.GENERATE_SKILL_QUESTIONS,
      { applicationId: application.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    this.logger.log(
      `[${this.rid}] submitProfile — complete | userId: ${userId}, applicationId: ${application.id}`,
    );

    return this.toStatusDto(application);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private toStatusDto(application: ConsultantApplication): ApplicationStatusResponseDto {
    return plainToInstance(
      ApplicationStatusResponseDto,
      {
        id: application.id,
        status: application.status,
        blocked_until: application.blockedUntil?.toISOString() ?? null,
        created_at: application.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
