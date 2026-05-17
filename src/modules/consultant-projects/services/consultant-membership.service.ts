import { ERROR_CODES } from '@common/constants/error-codes';
import {
  IConsultantProjectJoinedEvent,
  IConsultantProjectLeftEvent,
  NOTIFICATION_EVENTS,
} from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantProfile, Project, ProjectMember } from '@database/entities';
import { ProjectMemberStatus, ProjectStatus, TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { ConsultantMembershipResponseDto } from '../dto/responses';
import { IConsultantMembershipService } from '../interfaces/consultant-membership.service.interface';
import { ConsultantAccessService } from './consultant-access.service';

// Product rule: a consultant must match at least half of the project's
// required skills before they can join.
const MIN_SKILL_MATCH_RATE = 50;

// Statuses that count as "actively being worked on" — blocks leave because
// the consultant has open commitments. TO_DO / ASSIGNED don't block (work
// hasn't started, easy to reassign); DONE / CANCELLED are terminal.
const LEAVE_BLOCKING_STATUSES: readonly TaskKanbanStatus[] = [
  TaskKanbanStatus.IN_PROGRESS,
  TaskKanbanStatus.IN_REVIEW,
  TaskKanbanStatus.PENDING_APPROVAL,
  TaskKanbanStatus.REVISION_REQUESTED,
];

// Provisional cap, mirrored from ConsultantExploreService. The DB trigger
// `trg_enforce_consultant_project_limit` also enforces this server-side, but
// pre-checking here surfaces a friendly error code instead of a raw DB error.
const MAX_CONCURRENT_PROJECTS = 5;

@Injectable()
export class ConsultantMembershipService implements IConsultantMembershipService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly redis: RedisService,
    private readonly access: ConsultantAccessService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(ConsultantMembershipService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async apply(projectId: string): Promise<ConsultantMembershipResponseDto> {
    const consultantProfile = await this.access.resolveConsultantProfile();
    const consultantId = consultantProfile.id;
    this.logger.log(
      `[${this.rid}] apply — start | projectId: ${projectId}, consultantId: ${consultantId}`,
    );

    const project = await this.uow.projects.findOne({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(`[${this.rid}] apply — project not found | projectId: ${projectId}`);
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    if (
      project.status !== ProjectStatus.PUBLISHED &&
      project.status !== ProjectStatus.IN_PROGRESS
    ) {
      this.logger.warn(
        `[${this.rid}] apply — project not joinable | projectId: ${projectId}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_joinable',
        errorCode: ERROR_CODES.PROJECT_NOT_JOINABLE,
        status: HttpStatus.CONFLICT,
      });
    }

    const existing = await this.uow.projectMembers.findByProjectAndConsultant(
      projectId,
      consultantId,
    );
    if (existing) {
      if (existing.status === ProjectMemberStatus.ACTIVE) {
        this.logger.warn(
          `[${this.rid}] apply — already active member | projectId: ${projectId}, consultantId: ${consultantId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.already_member',
          errorCode: ERROR_CODES.PROJECT_ALREADY_MEMBER,
          status: HttpStatus.CONFLICT,
        });
      }
      if (existing.status === ProjectMemberStatus.REMOVED) {
        this.logger.warn(
          `[${this.rid}] apply — membership banned | projectId: ${projectId}, consultantId: ${consultantId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.membership_banned',
          errorCode: ERROR_CODES.PROJECT_MEMBERSHIP_BANNED,
          status: HttpStatus.FORBIDDEN,
        });
      }
      // status === LEFT — fall through; will reactivate inside the transaction.
    }

    await this.assertSkillMatch(projectId, consultantId);
    await this.assertConcurrencyHeadroom(consultantId);

    // Capacity check + insert/reactivate happen under a pessimistic write lock
    // on the project row so two parallel applies cannot both pass the
    // `total_members < required_consultants` gate.
    const result = await this.uow.withTransaction(async (tx) => {
      const lockedProject = await tx.projects.findByIdForUpdate(projectId);
      if (!lockedProject) {
        this.logger.warn(
          `[${this.rid}] apply — project disappeared under lock | projectId: ${projectId}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.not_found',
          errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      const liveCount = await tx.projectMembers.countActiveTotalByProjectIds([projectId]);
      if (liveCount >= lockedProject.requiredConsultants) {
        this.logger.warn(
          `[${this.rid}] apply — project full | projectId: ${projectId}, live: ${liveCount}, capacity: ${lockedProject.requiredConsultants}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.full',
          errorCode: ERROR_CODES.PROJECT_FULL,
          status: HttpStatus.CONFLICT,
        });
      }

      if (existing) {
        // Only LEFT reaches here — ACTIVE/REMOVED were rejected above.
        return tx.projectMembers.activate(existing);
      }
      return tx.projectMembers.save({
        projectId,
        consultantId,
        status: ProjectMemberStatus.ACTIVE,
        joinedAt: new Date(),
        leftAt: null,
      } as Partial<ProjectMember>);
    });

    await this.invalidateConsultantCaches(consultantId, projectId);
    await this.emitMembershipEvent(
      NOTIFICATION_EVENTS.CONSULTANT_PROJECT_JOINED,
      project,
      consultantProfile,
    );
    this.logger.log(
      `[${this.rid}] apply — complete | projectId: ${projectId}, memberId: ${result.id}`,
    );
    return this.toDto(result);
  }

  /** @inheritdoc */
  public async leave(projectId: string): Promise<ConsultantMembershipResponseDto> {
    const consultantProfile = await this.access.resolveConsultantProfile();
    const consultantId = consultantProfile.id;
    this.logger.log(
      `[${this.rid}] leave — start | projectId: ${projectId}, consultantId: ${consultantId}`,
    );

    const project = await this.uow.projects.findOne({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(`[${this.rid}] leave — project not found | projectId: ${projectId}`);
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const member = await this.uow.projectMembers.findByProjectAndConsultant(
      projectId,
      consultantId,
    );
    if (!member || member.status !== ProjectMemberStatus.ACTIVE) {
      this.logger.warn(
        `[${this.rid}] leave — not an active member | projectId: ${projectId}, consultantId: ${consultantId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_member',
        errorCode: ERROR_CODES.PROJECT_NOT_MEMBER,
        status: HttpStatus.FORBIDDEN,
      });
    }

    const counts = await this.uow.tasks.countByAssigneeAndProjectGroupedByStatus(
      consultantId,
      projectId,
    );
    const blockingCount = LEAVE_BLOCKING_STATUSES.reduce(
      (sum, status) => sum + (counts[status] ?? 0),
      0,
    );
    if (blockingCount > 0) {
      this.logger.warn(
        `[${this.rid}] leave — blocked by active tasks | projectId: ${projectId}, consultantId: ${consultantId}, blocking: ${blockingCount}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.leave_blocked_by_active_tasks',
        errorCode: ERROR_CODES.PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS,
        status: HttpStatus.CONFLICT,
      });
    }

    const updated = await this.uow.projectMembers.markLeft(member);

    await this.invalidateConsultantCaches(consultantId, projectId);
    await this.emitMembershipEvent(
      NOTIFICATION_EVENTS.CONSULTANT_PROJECT_LEFT,
      project,
      consultantProfile,
    );
    this.logger.log(
      `[${this.rid}] leave — complete | projectId: ${projectId}, memberId: ${updated.id}`,
    );
    return this.toDto(updated);
  }

  // ─── Validation helpers ────────────────────────────────────────────────────

  private async assertSkillMatch(projectId: string, consultantId: string): Promise<void> {
    const requiredCount = await this.uow.projectRequiredSkills.count({ where: { projectId } });
    // Vacuous case: a project with zero required skills accepts any consultant.
    if (requiredCount === 0) return;

    const row = await this.uow.consultantSkills
      .createQueryBuilder('cs')
      .select('COUNT(*)::int', 'count')
      .where('cs.consultant_id = :consultantId', { consultantId })
      .andWhere(
        'cs.skill_id IN (SELECT prs.skill_id FROM project_required_skills prs WHERE prs.project_id = :projectId)',
        { projectId },
      )
      .getRawOne<{ count: number }>();
    const matchedCount = Number(row?.count ?? 0);
    const matchRate = Math.round((matchedCount / requiredCount) * 100);

    if (matchRate < MIN_SKILL_MATCH_RATE) {
      this.logger.warn(
        `[${this.rid}] assertSkillMatch — insufficient | projectId: ${projectId}, consultantId: ${consultantId}, matchRate: ${matchRate}, required: ${requiredCount}, matched: ${matchedCount}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.skill_match_insufficient',
        errorCode: ERROR_CODES.PROJECT_SKILL_MATCH_INSUFFICIENT,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
  }

  private async assertConcurrencyHeadroom(consultantId: string): Promise<void> {
    const activeMembershipCount = await this.uow.projectMembers.count({
      where: { consultantId, status: ProjectMemberStatus.ACTIVE },
    });
    if (activeMembershipCount >= MAX_CONCURRENT_PROJECTS) {
      this.logger.warn(
        `[${this.rid}] assertConcurrencyHeadroom — limit reached | consultantId: ${consultantId}, active: ${activeMembershipCount}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.concurrent_limit_reached',
        errorCode: ERROR_CODES.PROJECT_CONCURRENT_LIMIT_REACHED,
        status: HttpStatus.CONFLICT,
      });
    }
  }

  // ─── Domain events ─────────────────────────────────────────────────────────
  // Fired AFTER commit so a rolled-back transaction never produces a spurious
  // notification. The dispatcher itself is async (Promise.allSettled on the
  // admin fan-out), so we don't block the HTTP response on delivery — but we
  // do await the businessProfile lookup to enrich the payload.

  private async emitMembershipEvent(
    eventName:
      | typeof NOTIFICATION_EVENTS.CONSULTANT_PROJECT_JOINED
      | typeof NOTIFICATION_EVENTS.CONSULTANT_PROJECT_LEFT,
    project: Project,
    consultantProfile: ConsultantProfile,
  ): Promise<void> {
    try {
      const businessProfile = await this.uow.businessProfiles.findOne({
        where: { id: project.businessId },
      });
      if (!businessProfile) {
        this.logger.warn(
          `[${this.rid}] emitMembershipEvent — business profile missing, skipping notifications | projectId: ${project.id}, businessId: ${project.businessId}`,
        );
        return;
      }
      const payload: IConsultantProjectJoinedEvent | IConsultantProjectLeftEvent = {
        consultant_user_id: consultantProfile.userId,
        consultant_name: consultantProfile.fullName,
        project_id: project.id,
        project_code: project.code,
        project_title: project.title,
        business_id: businessProfile.id,
        business_user_id: businessProfile.userId,
      };
      this.eventEmitter.emit(eventName, payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${this.rid}] emitMembershipEvent — failed | event: ${eventName}, projectId: ${project.id}, error: ${message}`,
      );
    }
  }

  // ─── Mapping ──────────────────────────────────────────────────────────────

  private toDto(member: ProjectMember): ConsultantMembershipResponseDto {
    return plainToInstance(
      ConsultantMembershipResponseDto,
      {
        project_id: member.projectId,
        status: member.status,
        joined_at: member.joinedAt,
        left_at: member.leftAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Cache invalidation ───────────────────────────────────────────────────
  // Pattern-deletes only the calling consultant's explore caches — other
  // consultants' caches are untouched (they'd see the new is_joined value only
  // after their own TTL expires). Redis failures are non-fatal: the next
  // explore read just falls through to the DB.

  private async invalidateConsultantCaches(consultantId: string, projectId: string): Promise<void> {
    // Apply/leave also flips the consultant's workspace switcher and the
    // joined-project list/detail/tasks views — wipe those prefixes too so
    // freshly-joined projects appear without waiting for a 60–120s TTL.
    const patterns = [
      `consultant_explore:list:${consultantId}:*`,
      `consultant_explore:detail:${consultantId}:*:${projectId}`,
      `consultant_workspaces:list:${consultantId}:*`,
      `consultant_joined:list:${consultantId}:*`,
      `consultant_joined:detail:${consultantId}:${projectId}`,
      `consultant_joined:tasks:${consultantId}:${projectId}:*`,
    ];
    try {
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        for (const key of keys) await this.redis.del(key);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${this.rid}] invalidateConsultantCaches — failed, falling back to TTL | consultantId: ${consultantId}, error: ${message}`,
      );
    }
  }
}
