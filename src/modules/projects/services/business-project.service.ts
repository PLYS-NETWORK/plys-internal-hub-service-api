import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import {
  BusinessProfile,
  Project,
  ProjectInterviewQuestion,
  ProjectRequiredSkill,
  Task,
} from '@database/entities';
import { ProjectStatus } from '@database/enums';
import { BusinessTransactionType } from '@database/enums/business-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import {
  CreateProjectDto,
  ListProjectsDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from '../dto/requests';
import { BusinessProjectResponseDto } from '../dto/responses';
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

@Injectable()
export class BusinessProjectService implements IBusinessProjectService {
  private readonly logger = new Logger(BusinessProjectService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly i18n: I18nService,
    private readonly projectRequiredSkillsService: ProjectRequiredSkillsService,
    private readonly projectInterviewQuestionsService: ProjectInterviewQuestionsService,
    private readonly projectTasksService: ProjectTasksService,
  ) {}

  /** @inheritdoc */
  public async createProject(dto: CreateProjectDto): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `[${this.rid}] createProject — start | businessId: ${businessId}, title: ${dto.title}`,
    );

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
      `[${this.rid}] createProject — complete | businessId: ${businessId}, projectId: ${project.id}, status: ${project.status}, skills: ${skills.length}, questions: ${questions.length}, tasks: ${tasks.length}`,
    );
    return this.toResponseDto(project, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async listMyProjects(dto: ListProjectsDto): Promise<PageDto<BusinessProjectResponseDto>> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `[${this.rid}] listMyProjects — start | businessId: ${businessId}, page: ${dto.page}, keywords: ${dto.keywords ?? 'none'}`,
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

    const data = projects.map((p) =>
      this.toResponseDto(
        p,
        skills.get(p.id) ?? [],
        questions.get(p.id) ?? [],
        tasks.get(p.id) ?? [],
      ),
    );
    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `[${this.rid}] listMyProjects — complete | businessId: ${businessId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async getProject(id: string): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`[${this.rid}] getProject — start | projectId: ${id}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] getProject — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
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
      `[${this.rid}] getProject — complete | projectId: ${id}, skills: ${skills.length}, questions: ${questions.length}, tasks: ${tasks.length}`,
    );
    return this.toResponseDto(project, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async updateProject(
    id: string,
    dto: UpdateProjectDto,
  ): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`[${this.rid}] updateProject — start | projectId: ${id}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] updateProject — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (LOCKED_STATUSES.has(project.status)) {
      this.logger.warn(
        `[${this.rid}] updateProject — locked status | projectId: ${id}, status: ${project.status}`,
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
      `[${this.rid}] updateProject — complete | projectId: ${updatedProject.id}, status: ${updatedProject.status}, skills: ${skills.length}, questions: ${questions.length}, tasks: ${tasks.length}`,
    );
    return this.toResponseDto(updatedProject, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async updateStatus(
    id: string,
    dto: UpdateProjectStatusDto,
  ): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `[${this.rid}] updateStatus — start | projectId: ${id}, targetStatus: ${dto.status}`,
    );

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] updateStatus — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
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
        this.logger.warn(
          `[${this.rid}] updateStatus — configured requires tasks | projectId: ${id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.requires_tasks_for_configured',
          errorCode: ERROR_CODES.PROJECT_REQUIRES_TASKS_FOR_CONFIGURED,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
    }

    // All other transition rules are enforced by the DB trigger
    // (trg_enforce_project_status). If the transition is illegal the DB will
    // raise an exception which propagates as a DATABASE_* error. We do not
    // duplicate that logic here.
    project.status = dto.status;
    const updatedProject = await this.uow.projects.save(project);

    const [skills, questions, tasks] = await Promise.all([
      this.projectRequiredSkillsService.findByProjectId(id),
      this.projectInterviewQuestionsService.findByProjectId(id),
      this.projectTasksService.findByProjectId(id),
    ]);
    this.logger.log(
      `[${this.rid}] updateStatus — complete | projectId: ${id}, status: ${updatedProject.status}`,
    );
    return this.toResponseDto(updatedProject, skills, questions, tasks);
  }

  /** @inheritdoc */
  public async validatePublish(projectId: string): Promise<PublishValidationResponseDto> {
    const businessProfile = await this.resolveBusinessProfile();
    this.logger.log(
      `[${this.rid}] validatePublish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessProfile.id);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] validatePublish — not found or forbidden | projectId: ${projectId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const result = await this.evaluatePublishEligibility(project, businessProfile);

    this.logger.log(
      `[${this.rid}] validatePublish — complete | projectId: ${projectId}, canPublish: ${result.canPublish}, paymentType: ${result.paymentType}`,
    );

    return plainToInstance(
      PublishValidationResponseDto,
      {
        can_publish: result.canPublish,
        reason_code: result.reasonCode,
        account_balance: result.accountBalance,
        project_title: project.title,
        project_amount: result.projectAmount,
        payment_type: result.paymentType,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async confirmPublish(projectId: string): Promise<void> {
    const businessProfile = await this.resolveBusinessProfile();
    this.logger.log(
      `[${this.rid}] confirmPublish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    const project = await this.uow.projects.findByIdAndBusinessId(projectId, businessProfile.id);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] confirmPublish — not found or forbidden | projectId: ${projectId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const eligibility = await this.evaluatePublishEligibility(project, businessProfile);

    if (!eligibility.canPublish) {
      if (eligibility.reasonCode === 'INSUFFICIENT_BALANCE') {
        this.logger.warn(
          `[${this.rid}] confirmPublish — insufficient balance | projectId: ${projectId}, balance: ${eligibility.accountBalance}, required: ${eligibility.projectAmount}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.insufficient_balance',
          errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }

      this.logger.warn(
        `[${this.rid}] confirmPublish — cannot publish | projectId: ${projectId}, reasonCode: ${eligibility.reasonCode}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.cannot_publish',
        errorCode: ERROR_CODES.PROJECT_CANNOT_PUBLISH,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    const updatedProject = await this.uow.withTransaction(async (txUow) => {
      // Deduct balance and record transaction for pre-paid businesses
      if (eligibility.paymentType === 'pre-paid') {
        const newBalance = parseFloat(businessProfile.accountBalance) - eligibility.projectAmount;
        businessProfile.accountBalance = newBalance.toFixed(2);
        await txUow.businessProfiles.save(businessProfile);

        const txn = txUow.businessTransactions.create({
          businessId: businessProfile.id,
          type: BusinessTransactionType.PROJECT_PUBLISHED,
          amount: eligibility.projectAmount.toFixed(2),
          status: TransactionStatus.COMPLETED,
          projectId,
          note: `Pre-paid project publication: ${project.title}`,
        });
        await txUow.businessTransactions.save(txn);
      }

      project.status = ProjectStatus.PUBLIC;
      return txUow.projects.save(project);
    });

    this.logger.log(
      `[${this.rid}] confirmPublish — complete | projectId: ${projectId}, status: ${updatedProject.status}`,
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async resolveBusinessId(): Promise<string> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(
        `[${this.rid}] resolveBusinessId — business profile not found | userId: ${userId}`,
      );
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
      this.logger.warn(`[${this.rid}] resolveBusinessProfile — not found | userId: ${userId}`);
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
   * Checks project status + payment affordability.
   */
  private async evaluatePublishEligibility(
    project: Project,
    businessProfile: BusinessProfile,
  ): Promise<{
    canPublish: boolean;
    reasonCode: string | null;
    accountBalance: number;
    projectAmount: number;
    paymentType: 'credit' | 'pre-paid';
  }> {
    const accountBalance = parseFloat(businessProfile.accountBalance);
    const paymentType: 'credit' | 'pre-paid' = businessProfile.allowPaymentCredit
      ? 'credit'
      : 'pre-paid';

    // Project must be in CONFIGURED status to be published
    if (project.status !== ProjectStatus.CONFIGURED) {
      const tasks = await this.uow.tasks.find({ where: { projectId: project.id } });
      const projectAmount = tasks.reduce((sum, t) => sum + Number(t.price), 0);

      return {
        canPublish: false,
        reasonCode: 'NOT_CONFIGURED',
        accountBalance,
        projectAmount,
        paymentType,
      };
    }

    // Compute total project amount from task prices
    const tasks = await this.uow.tasks.find({ where: { projectId: project.id } });
    const projectAmount = tasks.reduce((sum, t) => sum + Number(t.price), 0);

    // Credit-based businesses can always publish
    if (paymentType === 'credit') {
      return { canPublish: true, reasonCode: null, accountBalance, projectAmount, paymentType };
    }

    // Pre-paid: check balance covers project amount
    if (accountBalance >= projectAmount) {
      return { canPublish: true, reasonCode: null, accountBalance, projectAmount, paymentType };
    }

    return {
      canPublish: false,
      reasonCode: 'INSUFFICIENT_BALANCE',
      accountBalance,
      projectAmount,
      paymentType,
    };
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

  private toResponseDto(
    project: Project,
    skills: ProjectRequiredSkill[],
    questions: ProjectInterviewQuestion[],
    tasks: Task[],
  ): BusinessProjectResponseDto {
    const lang = this.requestContext.lang;

    return plainToInstance(
      BusinessProjectResponseDto,
      {
        id: project.id,
        businessId: project.businessId,
        title: project.title,
        introduction: project.introduction,
        status: project.status,
        requiredConsultants: project.requiredConsultants,
        publishedAt: project.publishedAt,
        startedAt: project.startedAt,
        completedAt: project.completedAt,
        cancelledAt: project.cancelledAt,
        createdAt: project.createdAt,
        skills: skills.map((s) => ({
          skill_id: s.skillId,
          skill_name: this.translateSkillKey(s.skill.name, lang),
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
