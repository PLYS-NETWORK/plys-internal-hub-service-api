import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { ApplicationStatus, ProjectMemberStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ListApplicationsDto, RejectApplicationDto } from '../dto/requests';
import { ApplicationDetailResponseDto, ApplicationListItemResponseDto } from '../dto/responses';
import { IApplicationsService } from '../interfaces/applications.service.interface';
import { BusinessAccessService } from './business-access.service';

interface IApplicationListRow {
  id: string;
  consultant_id: string;
  consultant_full_name: string;
  consultant_avatar_url: string | null;
  cover_letter: string | null;
  status: ApplicationStatus;
  applied_at: Date;
  reviewed_at: Date | null;
  matching_rate: number;
}

@Injectable()
export class ApplicationsService implements IApplicationsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly emailService: EmailService,
    private readonly envService: EnvironmentsService,
  ) {
    this.logger = new AppLogger(ApplicationsService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(
    projectId: string,
    dto: ListApplicationsDto,
  ): Promise<PageDto<ApplicationListItemResponseDto>> {
    this.logger.log(
      `list — start | projectId: ${projectId}, status: ${dto.status ?? 'any'}, page: ${dto.page}`,
    );
    await this.access.resolveOwnedProject(projectId);

    const orderDir: 'ASC' | 'DESC' = dto.order_by === 'ASC' ? 'ASC' : 'DESC';

    // Compose the matching_rate as a correlated subquery so listing + sorting
    // happen in a single round-trip. See plan §5 for the formula. Returns 0
    // when the project has no required skills.
    const matchingRateSql = `
      CASE
        WHEN (SELECT COUNT(*) FROM project_required_skills prs WHERE prs.project_id = pa.project_id) = 0
        THEN 0
        ELSE ROUND(
          (
            SELECT COUNT(*)::numeric
            FROM consultant_skills cs
            WHERE cs.consultant_id = pa.consultant_id
              AND cs.skill_id IN (SELECT prs.skill_id FROM project_required_skills prs WHERE prs.project_id = pa.project_id)
          ) /
          NULLIF(
            (SELECT COUNT(*)::numeric FROM project_required_skills prs WHERE prs.project_id = pa.project_id),
            0
          ) * 100
        )::int
      END
    `;

    const qb = this.uow.projectApplications
      .createQueryBuilder('pa')
      .innerJoin('pa.consultant', 'cp')
      .select('pa.id', 'id')
      .addSelect('pa.cover_letter', 'cover_letter')
      .addSelect('pa.status', 'status')
      .addSelect('pa.applied_at', 'applied_at')
      .addSelect('pa.reviewed_at', 'reviewed_at')
      .addSelect('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'consultant_full_name')
      .addSelect('cp.avatar_url', 'consultant_avatar_url')
      .addSelect(matchingRateSql, 'matching_rate')
      .where('pa.project_id = :projectId', { projectId });

    if (dto.status) qb.andWhere('pa.status = :status', { status: dto.status });

    // Pin PENDING applications to the top regardless of the requested sort —
    // they are the only ones the business can act on, so they always
    // outrank reviewed (ACCEPTED/REJECTED/WITHDRAWN) applications.
    const orderColumn = dto.sort_by === 'matching_rate' ? '"matching_rate"' : 'pa.applied_at';
    qb.orderBy(`CASE WHEN pa.status = :pendingStatus THEN 0 ELSE 1 END`, 'ASC')
      .setParameter('pendingStatus', ApplicationStatus.PENDING)
      .addOrderBy(orderColumn, orderDir)
      .addOrderBy('pa.id', 'ASC')
      .offset(dto.skip)
      .limit(dto.limit);

    const [rows, itemCount] = await Promise.all([
      qb.getRawMany<IApplicationListRow & { id: string }>(),
      this.uow.projectApplications.count({
        where: { projectId, ...(dto.status ? { status: dto.status } : {}) },
      }),
    ]);

    const data = rows.map((r) =>
      plainToInstance(
        ApplicationListItemResponseDto,
        {
          id: r.id,
          consultant: {
            id: r.consultant_id,
            full_name: r.consultant_full_name,
            avatar_url: r.consultant_avatar_url,
          },
          cover_letter: r.cover_letter,
          status: r.status,
          applied_at: r.applied_at,
          reviewed_at: r.reviewed_at,
          matching_rate: Number(r.matching_rate),
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });
    this.logger.log(
      `list — complete | projectId: ${projectId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async getDetail(
    projectId: string,
    applicationId: string,
  ): Promise<ApplicationDetailResponseDto> {
    this.logger.log(`getDetail — start | projectId: ${projectId}, applicationId: ${applicationId}`);
    await this.access.resolveOwnedProject(projectId);

    const application = await this.uow.projectApplications.findOne({
      where: { id: applicationId, projectId },
      relations: { consultant: true },
    });
    if (!application) {
      this.logger.warn(`getDetail — not found | applicationId: ${applicationId}`);
      throw new TranslatableException({
        messageKey: 'error.application.not_found',
        errorCode: ERROR_CODES.APPLICATION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [skills, answers, matchingRate] = await Promise.all([
      this.fetchConsultantSkills(application.consultantId),
      this.fetchInterviewAnswers(application.id),
      this.computeMatchingRate(projectId, application.consultantId),
    ]);

    const detail = {
      id: application.id,
      status: application.status,
      cover_letter: application.coverLetter ?? null,
      applied_at: application.appliedAt,
      reviewed_at: application.reviewedAt,
      rejection_reason: application.rejectionReason ?? null,
      matching_rate: matchingRate,
      consultant: {
        id: application.consultant.id,
        full_name: application.consultant.fullName,
        avatar_url: application.consultant.avatarUrl ?? null,
        skills,
      },
      interview_answers: answers,
    };

    this.logger.log(
      `getDetail — complete | applicationId: ${applicationId}, answers: ${answers.length}`,
    );

    return plainToInstance(ApplicationDetailResponseDto, detail, {
      excludeExtraneousValues: true,
    });
  }

  /** @inheritdoc */
  public async approve(projectId: string, applicationId: string): Promise<void> {
    this.logger.log(`approve — start | projectId: ${projectId}, applicationId: ${applicationId}`);
    await this.access.resolveOwnedProject(projectId);
    const userId = this.requestContext.userId!;

    const application = await this.uow.withTransaction(async (tx) => {
      // Lock the application row so two concurrent approve calls cannot both
      // create a ProjectMember.
      const locked = await tx.projectApplications
        .createQueryBuilder('pa')
        .where('pa.id = :id', { id: applicationId })
        .andWhere('pa.project_id = :projectId', { projectId })
        .setLock('pessimistic_write')
        .getOne();

      if (!locked) {
        throw new TranslatableException({
          messageKey: 'error.application.not_found',
          errorCode: ERROR_CODES.APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      this.assertPending(locked.status, 'approve');

      locked.status = ApplicationStatus.ACCEPTED;
      locked.reviewedAt = DateUtil.nowDate();
      locked.reviewedBy = userId;
      const saved = await tx.projectApplications.save(locked);

      const member = tx.projectMembers.create({
        projectId,
        consultantId: locked.consultantId,
        applicationId: locked.id,
        status: ProjectMemberStatus.ACTIVE,
      });
      await tx.projectMembers.save(member);

      return saved;
    });

    this.logger.log(
      `approve — complete | applicationId: ${applicationId}, status: ${application.status}`,
    );
    void this.sendStatusEmail(application.id, 'approve');
  }

  /** @inheritdoc */
  public async reject(
    projectId: string,
    applicationId: string,
    dto: RejectApplicationDto,
  ): Promise<void> {
    this.logger.log(`reject — start | projectId: ${projectId}, applicationId: ${applicationId}`);
    await this.access.resolveOwnedProject(projectId);
    const userId = this.requestContext.userId!;

    const application = await this.uow.withTransaction(async (tx) => {
      const locked = await tx.projectApplications
        .createQueryBuilder('pa')
        .where('pa.id = :id', { id: applicationId })
        .andWhere('pa.project_id = :projectId', { projectId })
        .setLock('pessimistic_write')
        .getOne();

      if (!locked) {
        throw new TranslatableException({
          messageKey: 'error.application.not_found',
          errorCode: ERROR_CODES.APPLICATION_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      this.assertPending(locked.status, 'reject');

      locked.status = ApplicationStatus.REJECTED;
      locked.reviewedAt = DateUtil.nowDate();
      locked.reviewedBy = userId;
      locked.rejectionReason = dto.rejectionReason ?? null;
      return tx.projectApplications.save(locked);
    });

    this.logger.log(
      `reject — complete | applicationId: ${applicationId}, status: ${application.status}`,
    );
    void this.sendStatusEmail(application.id, 'reject', dto.rejectionReason);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async computeMatchingRate(projectId: string, consultantId: string): Promise<number> {
    const reqRow = await this.uow.projectRequiredSkills
      .createQueryBuilder('prs')
      .select('COUNT(*)::int', 'count')
      .where('prs.project_id = :projectId', { projectId })
      .getRawOne<{ count: number }>();
    const requiredCount = Number(reqRow?.count ?? 0);
    if (requiredCount === 0) return 0;

    const matchedRow = await this.uow.consultantSkills
      .createQueryBuilder('cs')
      .select('COUNT(*)::int', 'count')
      .where('cs.consultant_id = :consultantId', { consultantId })
      .andWhere(
        'cs.skill_id IN (SELECT prs.skill_id FROM project_required_skills prs WHERE prs.project_id = :projectId)',
        { projectId },
      )
      .getRawOne<{ count: number }>();
    const matchedCount = Number(matchedRow?.count ?? 0);

    return Math.round((matchedCount / requiredCount) * 100);
  }

  private async fetchConsultantSkills(consultantId: string): Promise<
    Array<{
      id: string;
      name: string;
      proficiency_level: string;
      years_with_skill: number | null;
    }>
  > {
    const rows = await this.uow.consultantSkills
      .createQueryBuilder('cs')
      .innerJoin('cs.skill', 's')
      .select('s.id', 'id')
      .addSelect('s.name', 'name')
      .addSelect('cs.proficiency_level', 'proficiency_level')
      .addSelect('cs.years_with_skill', 'years_with_skill')
      .where('cs.consultant_id = :consultantId', { consultantId })
      .getRawMany<{
        id: string;
        name: string;
        proficiency_level: string;
        years_with_skill: number | null;
      }>();
    return rows;
  }

  private async fetchInterviewAnswers(applicationId: string): Promise<
    Array<{
      question_id: string;
      question_text_snapshot: string;
      answer: Record<string, unknown> | null;
      is_question_deleted: boolean;
    }>
  > {
    const answers = await this.uow.interviewAnswers.find({
      where: { applicationId },
    });
    if (answers.length === 0) return [];

    // Pull the questions including soft-deleted so the FE can render the
    // is_question_deleted flag.
    const questions = await this.uow.projectInterviewQuestions
      .createQueryBuilder('q')
      .where('q.id IN (:...ids)', { ids: answers.map((a) => a.questionId) })
      .withDeleted()
      .getMany();
    const byId = new Map(questions.map((q) => [q.id, q]));

    return answers.map((a) => ({
      question_id: a.questionId,
      question_text_snapshot: a.questionTextSnapshot,
      answer: a.answer,
      is_question_deleted: byId.get(a.questionId)?.deletedAt !== null,
    }));
  }

  private assertPending(status: ApplicationStatus, action: 'approve' | 'reject'): void {
    if (status === ApplicationStatus.PENDING) return;
    const errorCode =
      action === 'approve'
        ? ERROR_CODES.APPLICATION_CANNOT_APPROVE
        : ERROR_CODES.APPLICATION_CANNOT_REJECT;
    const messageKey =
      action === 'approve' ? 'error.application.cannot_approve' : 'error.application.cannot_reject';
    this.logger.warn(`assertPending — wrong status | status: ${status}, action: ${action}`);
    throw new TranslatableException({
      messageKey,
      errorCode,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }

  private async sendStatusEmail(
    applicationId: string,
    action: 'approve' | 'reject',
    rejectionReason?: string,
  ): Promise<void> {
    try {
      const application = await this.uow.projectApplications.findOne({
        where: { id: applicationId },
        relations: { consultant: true, project: true },
      });
      if (!application) return;
      const consultantUser = await this.uow.users.findByActiveId(application.consultant.userId);
      if (!consultantUser) return;

      const projectUrl =
        action === 'approve'
          ? `${this.envService.lonaUrl}/projects/${application.project.id}`
          : undefined;

      await this.emailService.sendApplicationStatusEmail(consultantUser.email, {
        consultantName: application.consultant.fullName,
        projectTitle: application.project.title,
        status: action === 'approve' ? 'approved' : 'rejected',
        rejectionReason,
        projectUrl,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendStatusEmail — failed | error: ${msg}`);
    }
  }
}
