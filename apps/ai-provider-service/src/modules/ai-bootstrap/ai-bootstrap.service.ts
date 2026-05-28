import { ProjectChatSessionService } from '@modules/project-chat-session/project-chat-session.service';
import { Injectable } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Project, ProjectAiContext, Skill, Task } from '@plys/libraries/database/entities';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import { BusinessAccessService } from '../../infrastructure/business-access/business-access.service';
import {
  AiBootstrapResponseDto,
  BootstrapAiContextDto,
  BootstrapLiveTaskDto,
  BootstrapProjectDto,
  BootstrapSkillDto,
} from './dto/responses';
import { IAiBootstrapService } from './interfaces/ai-bootstrap.service.interface';

@Injectable()
export class AiBootstrapService implements IAiBootstrapService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly chatSessions: ProjectChatSessionService,
    private readonly i18n: I18nService,
  ) {
    this.logger = new AppLogger(AiBootstrapService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async bootstrap(projectId: string): Promise<AiBootstrapResponseDto> {
    this.logger.log(`[${this.rid}] bootstrap — start | projectId: ${projectId}`);
    const { project } = await this.access.resolveOwnedProject(projectId);
    const lang = this.requestContext.lang;

    // Independent reads run in parallel — the access check above is the only
    // gating dependency. ProjectAiContext / required skills / tasks / sessions
    // / catalog are all read-only and don't share rows.
    const [contextRow, requiredSkillRows, taskRows, sessions, availableSkillRows] =
      await Promise.all([
        this.uow.projectAiContexts.findOne({ where: { projectId: project.id } }),
        this.uow.projectRequiredSkills.find({
          where: { projectId: project.id },
          relations: { skill: true },
        }),
        this.uow.tasks.find({
          where: { projectId: project.id },
          order: { displayOrder: 'ASC', id: 'ASC' },
        }),
        this.chatSessions.listProjectSessions(project.id),
        this.uow.skills.find({ order: { name: 'ASC' } }),
      ]);

    const live_skills = requiredSkillRows
      .map((row) => row.skill)
      .filter((s): s is Skill => Boolean(s))
      .map((skill) => this.toSkillDto(skill, lang));

    const available_skills = availableSkillRows.map((skill) => this.toSkillDto(skill, lang));

    const live_tasks = taskRows.map((task) => this.toLiveTaskDto(task));

    this.logger.log(
      `[${this.rid}] bootstrap — complete | projectId: ${project.id}, ` +
        `tasks: ${taskRows.length}, sessions: ${sessions.length}, ` +
        `skills_required: ${live_skills.length}, skills_catalog: ${available_skills.length}, ` +
        `context: ${contextRow ? 'present' : 'absent'}`,
    );

    return plainToInstance(
      AiBootstrapResponseDto,
      {
        project: this.toProjectDto(project),
        context: contextRow ? this.toContextDto(contextRow) : null,
        sessions,
        live_setting: { max_consultants: project.requiredConsultants },
        live_tasks,
        live_skills,
        available_skills,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toProjectDto(project: Project): BootstrapProjectDto {
    return plainToInstance(
      BootstrapProjectDto,
      {
        id: project.id,
        code: project.code,
        title: project.title,
        introduction: project.introduction,
        status: project.status,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toContextDto(row: ProjectAiContext): BootstrapAiContextDto {
    return plainToInstance(
      BootstrapAiContextDto,
      {
        domain: row.domain,
        primary_stack: row.primaryStack,
        conventions: row.conventions,
        task_index: row.taskIndex,
        skill_clusters: row.skillClusters,
        planning_summary: row.planningSummary,
        refine_summary: row.refineSummary,
        extend_summary: row.extendSummary,
        decisions: row.decisions,
        last_indexed_at: row.lastIndexedAt,
        needs_reindex: row.needsReindex,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toLiveTaskDto(task: Task): BootstrapLiveTaskDto {
    return plainToInstance(
      BootstrapLiveTaskDto,
      {
        id: task.id,
        code: task.code,
        title: task.title,
        description: task.description,
        price: Number(task.price).toFixed(2),
        creation_mode: task.creationMode,
        kanban_status: task.kanbanStatus,
        display_order: task.displayOrder,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toSkillDto(skill: Skill, lang: string): BootstrapSkillDto {
    return plainToInstance(
      BootstrapSkillDto,
      {
        id: skill.id,
        name: this.translateSkillKey(skill.name, lang),
      },
      { excludeExtraneousValues: true },
    );
  }

  // Skill names are i18n keys (e.g. `skill_react`); fall back to the raw key
  // so an unknown skill still renders rather than blowing up the response.
  private translateSkillKey(skillName: string, lang: string): string {
    try {
      const result = this.i18n.translate(`skill.${skillName}`, { lang }) as string;
      return result ?? skillName;
    } catch {
      return skillName;
    }
  }
}
