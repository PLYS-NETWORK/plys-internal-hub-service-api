import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Money } from '@common/utils/money';
import {
  BusinessProfile,
  Project,
  ProjectInterviewQuestion,
  ProjectRequiredSkill,
  Task,
} from '@database/entities';
import {
  BusinessTransactionType,
  PaymentMethod,
  ProjectStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';

import {
  CreateProjectDto,
  ListProjectsDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from '../dto/requests';
import { BusinessProjectResponseDto } from '../dto/responses';
import { ProjectMemberResponseDto } from '../dto/responses/project-member-response.dto';
import { PublishValidationResponseDto } from '../dto/responses/publish-validation-response.dto';
import { IBusinessProjectService } from '../interfaces';
import { ProjectInterviewQuestionsService } from './project-interview-questions.service';
import { ProjectRequiredSkillsService } from './project-required-skills.service';
import { ProjectTasksService } from './project-tasks.service';

/** Statuses where auto-derivation from setup state is allowed. */
const SETUP_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.DRAFT,
  ProjectStatus.SETTING_UP,
  ProjectStatus.CONFIGURED,
]);

/** Statuses where the project is locked and cannot be edited. */
const LOCKED_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.PUBLIC,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.DONE,
  ProjectStatus.CANCELLED,
]);

/** Default platform commission applied to pre-paid publications when the
 * business profile has no override (`commission_rate` IS NULL). */
const DEFAULT_COMMISSION_RATE = '0.25';

type PaymentType = 'credit' | 'pre-paid';

interface PublishEligibility {
  canPublish: boolean;
  reasonCode: string | null;
  accountBalance: Money;
  projectAmount: Money;
  commissionRate: string;
  commissionAmount: Money;
  totalAmount: Money;
  paymentType: PaymentType;
}

@Injectable()
export class BusinessProjectService implements IBusinessProjectService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly i18n: I18nService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly projectRequiredSkillsService: ProjectRequiredSkillsService,
    private readonly projectInterviewQuestionsService: ProjectInterviewQuestionsService,
    private readonly projectTasksService: ProjectTasksService,
  ) {
    this.logger = new AppLogger(BusinessProjectService.name, requestContext);
  }

  /** @inheritdoc */
  public async createProject(dto: CreateProjectDto): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`createProject — start | businessId: ${businessId}, title: ${dto.title}`);

    const requiredConsultants = dto.required_consultants ?? 1;
    const status = this.deriveInitialStatus();

    const [project, skills, questions, tasks] = await this.uow.withTransaction(async (txUow) => {
      const newProject = txUow.projects.create({
        businessId,
        title: dto.title,
        introduction: dto.introduction ?? null,
        requiredConsultants,
        status,
      });
      const savedProject = await txUow.projects.save(newProject);
      const savedSkills = await this.projectRequiredSkillsService.createForProject(
        savedProject.id,
        dto.skills ?? [],
        txUow,
      );
      const savedQuestions = await this.projectInterviewQuestionsService.createForProject(
        savedProject.id,
        dto.interviewQuestions ?? [],
        txUow,
      );
      const savedTasks = await this.projectTasksService.createForProject(
        savedProject.id,
        dto.tasks ?? [],
        txUow,
      );
      return [savedProject, savedSkills, savedQuestions, savedTasks] as const;
    });

    this.logger.log(
      `createProject — complete | businessId: ${businessId}, projectId: ${project.id}, status: ${project.status}, skills: ${skills.length}, questions: ${questions.length}, tasks: ${tasks.length}`,
    );
    return this.toResponseDto(project, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async listMyProjects(dto: ListProjectsDto): Promise<PageDto<BusinessProjectResponseDto>> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `listMyProjects — start | businessId: ${businessId}, page: ${dto.page}, keywords: ${dto.keywords ?? 'none'}`,
    );

    const [projects, itemCount] = await this.uow.projects.findByBusinessId(
      businessId,
      dto.skip,
      dto.limit,
      dto.keywords,
      dto.sort_by,
      dto.order_by,
    );

    const projectIds = projects.map((p) => p.id);
    const [skills, questions, tasks] = await Promise.all([
      this.loadSkillsForProjects(projectIds),
      this.loadQuestionsForProjects(projectIds),
      this.loadTasksForProjects(projectIds),
    ]);

    const allSkills: ProjectRequiredSkill[] = [];
    for (const list of skills.values()) allSkills.push(...list);
    const skillTranslations = this.translateSkillKeys(allSkills);

    const data = projects.map((p) =>
      this.toResponseDto(
        p,
        skills.get(p.id) ?? [],
        questions.get(p.id) ?? [],
        tasks.get(p.id) ?? [],
        skillTranslations,
      ),
    );
    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listMyProjects — complete | businessId: ${businessId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async getProject(id: string): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`getProject — start | projectId: ${id}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `getProject — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [skills, questions, tasks] = await Promise.all([
      this.projectRequiredSkillsService.findByProjectId(id),
      this.projectInterviewQuestionsService.findByProjectId(id),
      this.projectTasksService.findByProjectId(id),
    ]);
    this.logger.log(
      `getProject — complete | projectId: ${id}, skills: ${skills.length}, questions: ${questions.length}, tasks: ${tasks.length}`,
    );
    return this.toResponseDto(project, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async updateProject(
    id: string,
    dto: UpdateProjectDto,
  ): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`updateProject — start | projectId: ${id}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `updateProject — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (LOCKED_STATUSES.has(project.status)) {
      this.logger.warn(
        `updateProject — locked status | projectId: ${id}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.cannot_be_edited',
        errorCode: ERROR_CODES.PROJECT_CANNOT_BE_EDITED,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    const [updatedProject, skills, questions, tasks] = await this.uow.withTransaction(
      async (txUow) => {
        // Apply field updates to the entity in memory first.
        if (dto.title !== undefined) project.title = dto.title;
        if (dto.introduction !== undefined) project.introduction = dto.introduction;
        if (dto.required_consultants !== undefined)
          project.requiredConsultants = dto.required_consultants;

        // Resolve the post-update skill set before saving so we can derive status
        // in a single pass — avoids an extra round-trip after the save.
        const currentSkills =
          dto.skills !== undefined
            ? await this.projectRequiredSkillsService.replaceForProject(
                project.id,
                dto.skills,
                txUow,
              )
            : await this.projectRequiredSkillsService.findByProjectId(project.id, txUow);

        const currentQuestions =
          dto.interviewQuestions !== undefined
            ? await this.projectInterviewQuestionsService.replaceForProject(
                project.id,
                dto.interviewQuestions,
                txUow,
              )
            : await this.projectInterviewQuestionsService.findByProjectId(project.id, txUow);

        const currentTasks =
          dto.tasks !== undefined
            ? await this.projectTasksService.replaceForProject(project.id, dto.tasks, txUow)
            : await this.projectTasksService.findByProjectId(project.id, txUow);

        // Auto-derive setup status only while the project is still in a
        // pre-published state. PUBLIC / IN_PROGRESS / DONE / CANCELLED are not
        // touched — their transitions are governed by the DB trigger.
        if (SETUP_STATUSES.has(project.status)) {
          project.status = this.deriveSetupStatus(
            project.requiredConsultants,
            currentSkills.length,
            currentTasks.length,
          );
        }

        const savedProject = await txUow.projects.save(project);
        return [savedProject, currentSkills, currentQuestions, currentTasks] as const;
      },
    );

    this.logger.log(
      `updateProject — complete | projectId: ${updatedProject.id}, status: ${updatedProject.status}, skills: ${skills.length}, questions: ${questions.length}, tasks: ${tasks.length}`,
    );
    return this.toResponseDto(updatedProject, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async updateStatus(
    id: string,
    dto: UpdateProjectStatusDto,
  ): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`updateStatus — start | projectId: ${id}, targetStatus: ${dto.status}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `updateStatus — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Guard: `configured` requires at least one task. Enforce here so the
    // caller gets a clear domain error instead of a DB trigger rejection.
    if (dto.status === ProjectStatus.CONFIGURED) {
      const taskCount = await this.uow.tasks.count({ where: { projectId: id } as never });
      if (taskCount === 0) {
        this.logger.warn(`updateStatus — configured requires tasks | projectId: ${id}`);
        throw new TranslatableException({
          messageKey: 'error.project.requires_tasks_for_configured',
          errorCode: ERROR_CODES.PROJECT_REQUIRES_TASKS_FOR_CONFIGURED,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
    }

    // Recall: public → configured. Pre-paid businesses get a refund of the
    // original PROJECT_PUBLISHED charge. Credit businesses just transition.
    if (project.status === ProjectStatus.PUBLIC && dto.status === ProjectStatus.CONFIGURED) {
      return this.handleRecall(project);
    }

    // All other transition rules are enforced by the DB trigger
    // (trg_enforce_project_status). If the transition is illegal the DB will
    // raise P0001, which the global filter maps to PROJECT_INVALID_STATUS_TRANSITION.
    project.status = dto.status;
    const updatedProject = await this.uow.projects.save(project);

    const [skills, questions, tasks] = await Promise.all([
      this.projectRequiredSkillsService.findByProjectId(id),
      this.projectInterviewQuestionsService.findByProjectId(id),
      this.projectTasksService.findByProjectId(id),
    ]);
    this.logger.log(`updateStatus — complete | projectId: ${id}, status: ${updatedProject.status}`);
    return this.toResponseDto(updatedProject, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async validatePublish(projectId: string): Promise<PublishValidationResponseDto> {
    const businessProfile = await this.resolveBusinessProfile();
    this.logger.log(
      `validatePublish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessProfile.id);
    if (!project) {
      this.logger.warn(`validatePublish — not found or forbidden | projectId: ${projectId}`);
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const result = await this.evaluatePublishEligibility(project, businessProfile);

    this.logger.log(
      `validatePublish — complete | projectId: ${projectId}, canPublish: ${result.canPublish}, paymentType: ${result.paymentType}`,
    );

    return plainToInstance(
      PublishValidationResponseDto,
      {
        can_publish: result.canPublish,
        reason_code: result.reasonCode,
        account_balance: result.accountBalance.toNumber(),
        project_title: project.title,
        project_amount: result.projectAmount.toNumber(),
        commission_rate: Number(result.commissionRate),
        commission_amount: result.commissionAmount.toNumber(),
        total_amount: result.totalAmount.toNumber(),
        payment_type: result.paymentType,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async confirmPublish(projectId: string): Promise<void> {
    const businessProfile = await this.resolveBusinessProfile();
    this.logger.log(
      `confirmPublish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessProfile.id);
    if (!project) {
      this.logger.warn(`confirmPublish — not found or forbidden | projectId: ${projectId}`);
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // First-pass eligibility outside the transaction — quick reject for
    // unaffordable / mis-statused projects without taking row locks.
    const preview = await this.evaluatePublishEligibility(project, businessProfile);
    if (!preview.canPublish) {
      if (preview.reasonCode === 'INSUFFICIENT_BALANCE') {
        this.logger.warn(
          `confirmPublish — insufficient balance | projectId: ${projectId}, balance: ${preview.accountBalance.toFixedString()}, required: ${preview.totalAmount.toFixedString()}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.insufficient_balance',
          errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }

      this.logger.warn(
        `confirmPublish — cannot publish | projectId: ${projectId}, reasonCode: ${preview.reasonCode}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.cannot_publish',
        errorCode: ERROR_CODES.PROJECT_CANNOT_PUBLISH,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Lock + re-check + deduct atomically. Without the row lock two concurrent
    // publish calls could both pass the balance check and over-draw the
    // account; SELECT ... FOR UPDATE serialises the second caller behind the
    // first.
    const { updatedProject, eligibility } = await this.uow.withTransaction(async (txUow) => {
      const lockedProfile = await txUow.businessProfiles.findByIdForUpdate(businessProfile.id);
      if (!lockedProfile) {
        this.logger.warn(
          `confirmPublish — profile vanished mid-transaction | businessId: ${businessProfile.id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.business_profile.not_found',
          errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
          status: HttpStatus.FORBIDDEN,
        });
      }

      const lockedEligibility = await this.evaluatePublishEligibility(project, lockedProfile);
      if (!lockedEligibility.canPublish) {
        if (lockedEligibility.reasonCode === 'INSUFFICIENT_BALANCE') {
          this.logger.warn(
            `confirmPublish — insufficient balance after lock | projectId: ${projectId}, balance: ${lockedEligibility.accountBalance.toFixedString()}`,
          );
          throw new TranslatableException({
            messageKey: 'error.project.insufficient_balance',
            errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }
        throw new TranslatableException({
          messageKey: 'error.project.cannot_publish',
          errorCode: ERROR_CODES.PROJECT_CANNOT_PUBLISH,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }

      if (lockedEligibility.paymentType === 'pre-paid') {
        const newBalance = lockedEligibility.accountBalance.sub(lockedEligibility.totalAmount);
        if (newBalance.isNegative()) {
          // Defensive — the lock should have prevented this. Map to the same
          // user-facing error rather than letting the column constraint raise
          // a generic DB error.
          throw new TranslatableException({
            messageKey: 'error.project.insufficient_balance',
            errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }
        lockedProfile.accountBalance = newBalance.toFixedString();
        await txUow.businessProfiles.save(lockedProfile);

        const txn = txUow.businessTransactions.create({
          businessId: lockedProfile.id,
          type: BusinessTransactionType.PROJECT_PUBLISHED,
          amount: lockedEligibility.projectAmount.toFixedString(),
          commissionRate: Number(lockedEligibility.commissionRate).toFixed(4),
          commissionAmount: lockedEligibility.commissionAmount.toFixedString(),
          totalAmount: lockedEligibility.totalAmount.toFixedString(),
          status: TransactionStatus.COMPLETED,
          projectId,
          note: `Pre-paid project publication: ${project.title} (tasks: ${lockedEligibility.projectAmount.toFixedString()} + commission ${(Number(lockedEligibility.commissionRate) * 100).toFixed(0)}%: ${lockedEligibility.commissionAmount.toFixedString()})`,
        });
        await txUow.businessTransactions.save(txn);
      }

      project.status = ProjectStatus.PUBLIC;
      const saved = await txUow.projects.save(project);
      return { updatedProject: saved, eligibility: lockedEligibility };
    });

    this.logger.log(
      `confirmPublish — complete | projectId: ${projectId}, status: ${updatedProject.status}`,
    );

    // Send appropriate email based on payment type
    const user = await this.uow.users.findOne({ where: { id: businessProfile.userId } });
    if (user?.email) {
      try {
        if (eligibility.paymentType === 'pre-paid') {
          // Receipt number: short, unique, collision-resistant under concurrency.
          const receiptNumber = `PLY-${randomUUID().split('-')[0].toUpperCase()}`;
          const paidDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const projectDashboardUrl = `${this.env.ployosUrl}/c/${businessProfile.id}/projects/${projectId}`;

          await this.emailService.sendProjectPublishedReceiptEmail(user.email, {
            businessName: businessProfile.companyName || 'Business Owner',
            receiptNumber,
            paidDate,
            projectTitle: project.title,
            paymentMethod: PaymentMethod.ACCOUNT_BALANCE,
            amount: eligibility.projectAmount.toFixedString(),
            commissionRate: (Number(eligibility.commissionRate) * 100).toFixed(2),
            commissionAmount: eligibility.commissionAmount.toFixedString(),
            totalAmount: eligibility.totalAmount.toFixedString(),
            projectDashboardUrl,
          });

          this.logger.log(
            `confirmPublish — receipt email sent | projectId: ${projectId}, email: ${user.email}`,
          );
        } else {
          const projectHubUrl = `${this.env.ployosUrl}/c/${businessProfile.id}/projects/${projectId}`;

          await this.emailService.sendProjectPublishedSuccessEmail(user.email, {
            businessName: businessProfile.companyName || 'Business Owner',
            projectTitle: project.title,
            projectHubUrl,
          });

          this.logger.log(
            `confirmPublish — success email sent | projectId: ${projectId}, email: ${user.email}`,
          );
        }
      } catch (error) {
        // Don't fail the project publishing if email fails
        this.logger.error(
          `confirmPublish — failed to send project email | projectId: ${projectId}, paymentType: ${eligibility.paymentType}, error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /** @inheritdoc */
  public async listProjectMembers(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ProjectMemberResponseDto>> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `listProjectMembers — start | projectId: ${projectId}, page: ${pageOptions.page}`,
    );

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessId);
    if (!project) {
      this.logger.warn(
        `listProjectMembers — not found or forbidden | projectId: ${projectId}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [members, itemCount] = await this.uow.projectMembers.findAndCount({
      where: { projectId },
      relations: { consultant: true },
      skip: pageOptions.skip,
      take: pageOptions.limit,
      order: { joinedAt: 'ASC' },
    });

    const data = members.map((m) =>
      plainToInstance(
        ProjectMemberResponseDto,
        {
          id: m.id,
          consultant_id: m.consultantId,
          avatar_url: m.consultant.avatarUrl,
          full_name: m.consultant.fullName,
          status: m.status,
          joined_at: m.joinedAt,
          address: {
            address_line: m.consultant.addressLine,
            city: m.consultant.city,
            state_province: m.consultant.stateProvince,
            postal_code: m.consultant.postalCode,
            country_code: m.consultant.countryCode,
          },
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: pageOptions, itemCount });

    this.logger.log(
      `listProjectMembers — complete | projectId: ${projectId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async deleteProject(id: string): Promise<void> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`deleteProject — start | projectId: ${id}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `deleteProject — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (!SETUP_STATUSES.has(project.status)) {
      this.logger.warn(
        `deleteProject — status prevents deletion | projectId: ${id}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.cannot_be_deleted',
        errorCode: ERROR_CODES.PROJECT_CANNOT_BE_DELETED,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    await this.uow.projects.softDelete(id);
    this.logger.log(`deleteProject — complete | projectId: ${id}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Handles project recall: public → configured. Pre-paid businesses receive
   * a refund of the original PROJECT_PUBLISHED charge amount. Credit-based
   * businesses simply transition without any financial side-effects.
   *
   * Why transactional + locked: balance credit + refund transaction + status
   * change must be atomic, and the lock prevents a concurrent publish from
   * racing with the refund and corrupting the running balance.
   */
  private async handleRecall(project: Project): Promise<BusinessProjectResponseDto> {
    const businessProfile = await this.resolveBusinessProfile();
    this.logger.log(
      `handleRecall — start | projectId: ${project.id}, businessId: ${businessProfile.id}`,
    );

    const updatedProject = await this.uow.withTransaction(async (txUow) => {
      // Pre-paid businesses need a refund of the original publish charge
      if (!businessProfile.allowPaymentCredit) {
        const lockedProfile = await txUow.businessProfiles.findByIdForUpdate(businessProfile.id);
        if (!lockedProfile) {
          throw new TranslatableException({
            messageKey: 'error.business_profile.not_found',
            errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
            status: HttpStatus.FORBIDDEN,
          });
        }

        const originalTxn = await txUow.businessTransactions.findOne({
          where: {
            projectId: project.id,
            type: BusinessTransactionType.PROJECT_PUBLISHED,
            status: TransactionStatus.COMPLETED,
          },
        });

        if (!originalTxn) {
          this.logger.warn(
            `handleRecall — original publish transaction not found | projectId: ${project.id}`,
          );
          throw new TranslatableException({
            messageKey: 'error.project.recall_transaction_not_found',
            errorCode: ERROR_CODES.PROJECT_RECALL_TRANSACTION_NOT_FOUND,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }

        const newBalance = Money.from(lockedProfile.accountBalance).add(
          Money.from(originalTxn.amount),
        );
        lockedProfile.accountBalance = newBalance.toFixedString();
        await txUow.businessProfiles.save(lockedProfile);

        const refundTxn = txUow.businessTransactions.create({
          businessId: lockedProfile.id,
          type: BusinessTransactionType.REFUND,
          amount: originalTxn.amount,
          totalAmount: originalTxn.amount,
          status: TransactionStatus.COMPLETED,
          projectId: project.id,
          note: `Project recall refund: ${project.title}`,
        });
        await txUow.businessTransactions.save(refundTxn);

        this.logger.log(
          `handleRecall — refund issued | projectId: ${project.id}, amount: ${originalTxn.amount}, newBalance: ${lockedProfile.accountBalance}`,
        );
      }

      project.status = ProjectStatus.CONFIGURED;
      return txUow.projects.save(project);
    });

    const [skills, questions, tasks] = await Promise.all([
      this.projectRequiredSkillsService.findByProjectId(project.id),
      this.projectInterviewQuestionsService.findByProjectId(project.id),
      this.projectTasksService.findByProjectId(project.id),
    ]);

    this.logger.log(
      `handleRecall — complete | projectId: ${project.id}, status: ${updatedProject.status}`,
    );
    return this.toResponseDto(updatedProject, skills, questions, tasks);
  }

  private async resolveBusinessId(): Promise<string> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`resolveBusinessId — business profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return profile.id;
  }

  private async resolveBusinessProfile(): Promise<BusinessProfile> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`resolveBusinessProfile — not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return profile;
  }

  /**
   * Shared validation logic for publish eligibility.
   * Checks project status + payment affordability using fixed-point money math.
   */
  private async evaluatePublishEligibility(
    project: Project,
    businessProfile: BusinessProfile,
  ): Promise<PublishEligibility> {
    const accountBalance = Money.from(businessProfile.accountBalance);
    const paymentType: PaymentType = businessProfile.allowPaymentCredit ? 'credit' : 'pre-paid';

    const tasks = await this.uow.tasks.find({ where: { projectId: project.id } });
    const projectAmount = Money.sum(tasks.map((t) => t.price));

    // Commission only applies to pre-paid businesses.
    const commissionRate =
      paymentType === 'pre-paid'
        ? (businessProfile.commissionRate ?? DEFAULT_COMMISSION_RATE)
        : '0';
    const commissionAmount = projectAmount.mulRate(commissionRate);
    const totalAmount = projectAmount.add(commissionAmount);

    const baseResult = {
      accountBalance,
      projectAmount,
      commissionRate,
      commissionAmount,
      totalAmount,
      paymentType,
    };

    if (project.status !== ProjectStatus.CONFIGURED) {
      return { ...baseResult, canPublish: false, reasonCode: 'NOT_CONFIGURED' };
    }

    if (paymentType === 'credit') {
      // Credit-based businesses are billed monthly; the publish call itself
      // does not move money. Zero out commission for the response payload.
      return {
        ...baseResult,
        commissionRate: '0',
        commissionAmount: Money.zero(),
        totalAmount: projectAmount,
        canPublish: true,
        reasonCode: null,
      };
    }

    if (accountBalance.gte(totalAmount)) {
      return { ...baseResult, canPublish: true, reasonCode: null };
    }

    return { ...baseResult, canPublish: false, reasonCode: 'INSUFFICIENT_BALANCE' };
  }

  /**
   * Derives the initial status for a newly created project.
   * Always returns `draft` — tasks cannot exist at creation time, so neither
   * `setting_up` nor `configured` are reachable.
   */
  private deriveInitialStatus(): ProjectStatus {
    return ProjectStatus.DRAFT;
  }

  /**
   * Derives the setup status after an update.
   * Priority order:
   * 1. `configured`  — taskCount > 0 AND requiredConsultants ≥ 1 AND skillCount > 0
   * 2. `setting_up`  — taskCount > 0
   * 3. `draft`       — none of the above
   */
  private deriveSetupStatus(
    requiredConsultants: number,
    skillCount: number,
    taskCount: number,
  ): ProjectStatus {
    if (taskCount > 0 && requiredConsultants >= 1 && skillCount > 0)
      return ProjectStatus.CONFIGURED;
    if (taskCount > 0) return ProjectStatus.SETTING_UP;

    return ProjectStatus.DRAFT;
  }

  // Loads interview questions for a list of project IDs in a single query (avoids N+1).
  private async loadQuestionsForProjects(
    projectIds: string[],
  ): Promise<Map<string, ProjectInterviewQuestion[]>> {
    if (projectIds.length === 0) return new Map();

    const allQuestions = await this.uow.projectInterviewQuestions.find({
      where: projectIds.map((id) => ({ projectId: id })),
      order: { displayOrder: 'ASC' },
    });

    const byProject = new Map<string, ProjectInterviewQuestion[]>();
    for (const question of allQuestions) {
      const list = byProject.get(question.projectId) ?? [];
      list.push(question);
      byProject.set(question.projectId, list);
    }
    return byProject;
  }

  // Loads tasks for a list of project IDs in a single query (avoids N+1).
  private async loadTasksForProjects(projectIds: string[]): Promise<Map<string, Task[]>> {
    if (projectIds.length === 0) return new Map();

    const allTasks = await this.uow.tasks.find({
      where: projectIds.map((id) => ({ projectId: id })),
      order: { displayOrder: 'ASC' },
    });

    const byProject = new Map<string, Task[]>();
    for (const task of allTasks) {
      const list = byProject.get(task.projectId) ?? [];
      list.push(task);
      byProject.set(task.projectId, list);
    }
    return byProject;
  }

  // Loads required skills for a list of project IDs in a single query (avoids N+1).
  private async loadSkillsForProjects(
    projectIds: string[],
  ): Promise<Map<string, ProjectRequiredSkill[]>> {
    if (projectIds.length === 0) return new Map();

    const allSkills = await this.uow.projectRequiredSkills.find({
      where: projectIds.map((id) => ({ projectId: id })),
      relations: { skill: true },
    });

    const byProject = new Map<string, ProjectRequiredSkill[]>();
    for (const skill of allSkills) {
      const list = byProject.get(skill.projectId) ?? [];
      list.push(skill);
      byProject.set(skill.projectId, list);
    }
    return byProject;
  }

  // Translates each unique skill key once per request locale, so a list of
  // N projects sharing M skills runs at most M i18n calls instead of N×M.
  private translateSkillKeys(skills: ProjectRequiredSkill[]): Map<string, string> {
    const lang = this.requestContext.lang;
    const out = new Map<string, string>();
    for (const s of skills) {
      const key = s.skill.name;
      if (out.has(key)) continue;
      out.set(key, this.translateSkillKey(key, lang));
    }
    return out;
  }

  private toResponseDto(
    project: Project,
    skills: ProjectRequiredSkill[],
    questions: ProjectInterviewQuestion[],
    tasks: Task[],
    skillTranslations?: Map<string, string>,
  ): BusinessProjectResponseDto {
    const lang = this.requestContext.lang;
    const translate = (name: string): string =>
      skillTranslations?.get(name) ?? this.translateSkillKey(name, lang);

    return plainToInstance(
      BusinessProjectResponseDto,
      {
        id: project.id,
        business_id: project.businessId,
        title: project.title,
        introduction: project.introduction,
        status: project.status,
        required_consultants: project.requiredConsultants,
        published_at: project.publishedAt,
        started_at: project.startedAt,
        completed_at: project.completedAt,
        cancelled_at: project.cancelledAt,
        created_at: project.createdAt,
        skills: skills.map((s) => ({
          skill_id: s.skillId,
          skill_name: translate(s.skill.name),
        })),
        interview_questions: questions.map((q) => ({
          id: q.id,
          question_text: q.questionText,
          display_order: q.displayOrder,
          is_required: q.isRequired,
        })),
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          price: t.price,
          platform_fee_amount: t.platformFeeAmount,
          consultant_payout: t.consultantPayout,
          difficulty_level: t.difficultyLevel,
          kanban_status: t.kanbanStatus,
          display_order: t.displayOrder,
          created_at: t.createdAt,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  private translateSkillKey(skillName: string, lang: string): string {
    try {
      const result = this.i18n.translate(`skill.${skillName}`, { lang }) as string;
      // nestjs-i18n returns the key itself when no translation is found — use as fallback.
      return result ?? skillName;
    } catch {
      return skillName;
    }
  }
}
