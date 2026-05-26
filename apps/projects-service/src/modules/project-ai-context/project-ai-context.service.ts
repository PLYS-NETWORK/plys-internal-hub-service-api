import { BusinessAccessService } from '@modules/business-projects/services/business-access.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ProjectAiContext, Task } from '@plys/libraries/database/entities';
import { IUnitOfWork } from '@plys/libraries/unit-of-work/interfaces/unit-of-work.interface';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { LogDecisionDto, UpdateDerivedContextDto } from './dto/requests';
import { AiContextResponseDto } from './dto/responses';
import {
  IProjectAiContextService,
  ITaskIndexEntry,
} from './interfaces/project-ai-context.service.interface';

// Append-only audit shape for `project_ai_context.decisions`. Two flavours:
//   - explicit user decisions logged via POST /ai-context/decisions
//   - implicit `derived_write` rows the BE appends on each PATCH /derived
// The BE never reads these — they're a forensic trail.
interface IDerivedWriteAudit extends Record<string, unknown> {
  at: string;
  source: 'derived_write';
  actor_user_id: string | null;
  request_id: string;
  fields_changed: string[];
}

interface IUserDecisionAudit extends Record<string, unknown> {
  at: string;
  source: 'planning' | 'refine' | 'extend';
  actor_user_id: string | null;
  request_id: string;
  decision: string;
  rationale: string;
}

@Injectable()
export class ProjectAiContextService implements IProjectAiContextService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
  ) {
    this.logger = new AppLogger(ProjectAiContextService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async ensureExists(tx: IUnitOfWork, projectId: string): Promise<void> {
    const existing = await tx.projectAiContexts.findOne({ where: { projectId } });
    if (existing) return;
    await tx.projectAiContexts.save(
      tx.projectAiContexts.create({
        projectId,
        taskIndex: [],
        skillClusters: {},
        decisions: [],
        taskCountAtIndex: 0,
        needsReindex: false,
      }),
    );
    this.logger.log(`[${this.rid}] ensureExists — created | projectId: ${projectId}`);
  }

  /** @inheritdoc */
  public async patchTaskInIndex(tx: IUnitOfWork, projectId: string, task: Task): Promise<void> {
    await this.ensureExists(tx, projectId);
    const ctx = await tx.projectAiContexts.findOne({ where: { projectId } });
    if (!ctx) return; // unreachable — ensureExists succeeded above

    const idx = (ctx.taskIndex as ITaskIndexEntry[]).findIndex((t) => t.id === task.id);
    const existing = idx >= 0 ? (ctx.taskIndex as ITaskIndexEntry[])[idx] : null;
    const entry: ITaskIndexEntry = {
      id: task.id,
      title: task.title,
      price: Number(task.price).toFixed(2),
      kanban_status: task.kanbanStatus,
      // Preserve any FE-derived summary on update; new tasks start with null
      // and rely on the FE to backfill via PATCH /ai-context/derived once
      // it sees `needs_reindex = true`.
      summary: existing?.summary ?? null,
    };

    if (idx >= 0) {
      (ctx.taskIndex as ITaskIndexEntry[])[idx] = entry;
    } else {
      (ctx.taskIndex as ITaskIndexEntry[]).push(entry);
      // New task → derived fields (domain, conventions, summaries) are now
      // stale; signal the FE.
      ctx.needsReindex = true;
    }

    await tx.projectAiContexts.save(ctx);
    this.logger.log(
      `[${this.rid}] patchTaskInIndex — complete | projectId: ${projectId}, taskId: ${task.id}, ` +
        `op: ${idx >= 0 ? 'update' : 'insert'}, size: ${ctx.taskIndex.length}`,
    );
  }

  /** @inheritdoc */
  public async removeManyFromIndex(
    tx: IUnitOfWork,
    projectId: string,
    taskIds: string[],
  ): Promise<void> {
    if (taskIds.length === 0) return;
    const ctx = await tx.projectAiContexts.findOne({ where: { projectId } });
    if (!ctx) return; // nothing to remove

    const before = ctx.taskIndex.length;
    const removeSet = new Set(taskIds);
    ctx.taskIndex = (ctx.taskIndex as ITaskIndexEntry[]).filter((t) => !removeSet.has(t.id));
    const removed = before - ctx.taskIndex.length;
    if (removed === 0) return;

    // Bulk delete potentially shifts the AI-derived view (skill clusters,
    // domain inferences) — flag for the FE to re-derive.
    ctx.needsReindex = true;
    await tx.projectAiContexts.save(ctx);
    this.logger.log(
      `[${this.rid}] removeManyFromIndex — complete | projectId: ${projectId}, removed: ${removed}, remaining: ${ctx.taskIndex.length}`,
    );
  }

  /** @inheritdoc */
  public async getContext(projectId: string): Promise<AiContextResponseDto> {
    this.logger.log(`[${this.rid}] getContext — start | projectId: ${projectId}`);
    const ctx = await this.uow.projectAiContexts.findOne({ where: { projectId } });
    if (!ctx) {
      this.logger.warn(`[${this.rid}] getContext — not found | projectId: ${projectId}`);
      throw new TranslatableException({
        messageKey: 'error.ai_context.not_found',
        errorCode: ERROR_CODES.AI_CONTEXT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    this.logger.log(
      `[${this.rid}] getContext — complete | projectId: ${projectId}, tasks: ${ctx.taskIndex.length}, decisions: ${ctx.decisions.length}`,
    );
    return this.toResponseDto(ctx);
  }

  /** @inheritdoc */
  public async logDecision(projectId: string, dto: LogDecisionDto): Promise<AiContextResponseDto> {
    this.logger.log(
      `[${this.rid}] logDecision — start | projectId: ${projectId}, source: ${dto.source}`,
    );
    await this.access.resolveOwnedProject(projectId);
    const updated = await this.uow.withTransaction(async (tx) => {
      await this.ensureExists(tx, projectId);
      const ctx = await tx.projectAiContexts.findOne({ where: { projectId } });
      if (!ctx) {
        // Unreachable — ensureExists just succeeded.
        throw new Error('logDecision: context disappeared between ensure and read');
      }
      const audit: IUserDecisionAudit = {
        at: new Date().toISOString(),
        source: dto.source,
        actor_user_id: this.requestContext.userId,
        request_id: this.rid,
        decision: dto.decision,
        rationale: dto.rationale,
      };
      ctx.decisions = [...ctx.decisions, audit];
      return tx.projectAiContexts.save(ctx);
    });
    this.logger.log(
      `[${this.rid}] logDecision — complete | projectId: ${projectId}, decisions: ${updated.decisions.length}`,
    );
    return this.toResponseDto(updated);
  }

  /** @inheritdoc */
  public async updateDerived(
    projectId: string,
    dto: UpdateDerivedContextDto,
  ): Promise<AiContextResponseDto> {
    const fieldsChanged = this.collectChangedFields(dto);
    this.logger.log(
      `[${this.rid}] updateDerived — start | projectId: ${projectId}, fields: ${fieldsChanged.length === 0 ? '<none>' : fieldsChanged.join(',')}`,
    );
    await this.access.resolveOwnedProject(projectId);

    const updated = await this.uow.withTransaction(async (tx) => {
      await this.ensureExists(tx, projectId);
      const ctx = await tx.projectAiContexts.findOne({ where: { projectId } });
      if (!ctx) {
        throw new Error('updateDerived: context disappeared between ensure and read');
      }

      if (dto.domain !== undefined) ctx.domain = dto.domain;
      if (dto.primaryStack !== undefined) ctx.primaryStack = dto.primaryStack;
      if (dto.conventions !== undefined) ctx.conventions = dto.conventions;
      if (dto.planningSummary !== undefined) ctx.planningSummary = dto.planningSummary;
      if (dto.refineSummary !== undefined) ctx.refineSummary = dto.refineSummary;
      if (dto.extendSummary !== undefined) ctx.extendSummary = dto.extendSummary;
      if (dto.skillClusters !== undefined) ctx.skillClusters = dto.skillClusters;

      if (dto.taskSummaries && dto.taskSummaries.length > 0) {
        const summaryByTaskId = new Map(
          dto.taskSummaries.map((p) => [p.taskId, p.summary] as const),
        );
        ctx.taskIndex = (ctx.taskIndex as ITaskIndexEntry[]).map((entry) =>
          summaryByTaskId.has(entry.id)
            ? { ...entry, summary: summaryByTaskId.get(entry.id) ?? null }
            : entry,
        );
      }

      // Audit row — append, never trim. Forensic trail without a separate
      // table; admins can grep `source: 'derived_write'` in `decisions`.
      const audit: IDerivedWriteAudit = {
        at: new Date().toISOString(),
        source: 'derived_write',
        actor_user_id: this.requestContext.userId,
        request_id: this.rid,
        fields_changed: fieldsChanged,
      };
      ctx.decisions = [...ctx.decisions, audit];

      // FE asserts it has just re-derived; clear the staleness flag and
      // stamp `last_indexed_at` for the cron sweep.
      ctx.needsReindex = false;
      ctx.lastIndexedAt = new Date();
      ctx.taskCountAtIndex = ctx.taskIndex.length;

      return tx.projectAiContexts.save(ctx);
    });

    this.logger.log(
      `[${this.rid}] updateDerived — complete | projectId: ${projectId}, fields: ${fieldsChanged.length}, indexed: ${updated.taskCountAtIndex}`,
    );
    return this.toResponseDto(updated);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private collectChangedFields(dto: UpdateDerivedContextDto): string[] {
    const out: string[] = [];
    if (dto.domain !== undefined) out.push('domain');
    if (dto.primaryStack !== undefined) out.push('primary_stack');
    if (dto.conventions !== undefined) out.push('conventions');
    if (dto.planningSummary !== undefined) out.push('planning_summary');
    if (dto.refineSummary !== undefined) out.push('refine_summary');
    if (dto.extendSummary !== undefined) out.push('extend_summary');
    if (dto.skillClusters !== undefined) out.push('skill_clusters');
    if (dto.taskSummaries && dto.taskSummaries.length > 0) out.push('task_summaries');
    return out;
  }

  private toResponseDto(ctx: ProjectAiContext): AiContextResponseDto {
    return plainToInstance(
      AiContextResponseDto,
      {
        project_id: ctx.projectId,
        domain: ctx.domain,
        primary_stack: ctx.primaryStack,
        conventions: ctx.conventions,
        task_index: ctx.taskIndex,
        skill_clusters: ctx.skillClusters,
        planning_summary: ctx.planningSummary,
        refine_summary: ctx.refineSummary,
        extend_summary: ctx.extendSummary,
        decisions: ctx.decisions,
        last_indexed_at: ctx.lastIndexedAt,
        task_count_at_index: ctx.taskCountAtIndex,
        needs_reindex: ctx.needsReindex,
        created_at: ctx.createdAt,
        updated_at: ctx.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
