import { Injectable } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ProjectStatus, TaskKanbanStatus } from '@plys/libraries/database/enums';
import { IUnitOfWork } from '@plys/libraries/unit-of-work/interfaces/unit-of-work.interface';

import { IProjectStatusService } from '../../interfaces/project-status.service.interface';

// Statuses where the setup-phase recompute is allowed to act. Anything outside
// this set (PUBLISHED / IN_PROGRESS / DONE / CANCELLED) is a downstream state
// that must not be auto-mutated by completeness signals.
const SETUP_PHASE_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.DRAFT,
  ProjectStatus.CONFIGURED,
]);

@Injectable()
export class ProjectStatusService implements IProjectStatusService {
  private readonly logger: AppLogger;

  constructor(private readonly requestContext: RequestContextService) {
    this.logger = new AppLogger(ProjectStatusService.name, requestContext);
  }

  /** @inheritdoc */
  public async recomputeAutoStatus(tx: IUnitOfWork, projectId: string): Promise<ProjectStatus> {
    const project = await tx.projects.findOne({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(`recomputeAutoStatus — project not found | projectId: ${projectId}`);
      return ProjectStatus.DRAFT;
    }

    // `publishedAt` is the load-bearing guard: once the project has ever been
    // published, completeness signals are irrelevant and republish must not be
    // demoted to DRAFT after `payTasks` converts drafts to TO_DO.
    if (project.publishedAt !== null || !SETUP_PHASE_STATUSES.has(project.status)) {
      return project.status;
    }

    const [draftCount, skillCount] = await Promise.all([
      tx.tasks.count({
        where: { projectId, kanbanStatus: TaskKanbanStatus.DRAFT },
      }),
      tx.projectRequiredSkills.count({ where: { projectId } }),
    ]);

    const desired = this.computeDesiredStatus(draftCount, skillCount, project.requiredConsultants);

    if (desired === project.status) {
      return project.status;
    }

    const previous = project.status;
    project.status = desired;
    await tx.projects.save(project);

    this.logger.log(
      `recomputeAutoStatus — change | projectId: ${projectId}, from: ${previous}, to: ${desired}, drafts: ${draftCount}, skills: ${skillCount}, consultants: ${project.requiredConsultants}`,
    );

    return desired;
  }

  /** @inheritdoc */
  public async promoteToInProgressIfPublished(
    tx: IUnitOfWork,
    projectId: string,
  ): Promise<ProjectStatus> {
    const project = await tx.projects.findOne({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(
        `promoteToInProgressIfPublished — project not found | projectId: ${projectId}`,
      );
      return ProjectStatus.DRAFT;
    }

    if (project.status !== ProjectStatus.PUBLISHED) {
      return project.status;
    }

    project.status = ProjectStatus.IN_PROGRESS;
    await tx.projects.save(project);

    this.logger.log(
      `promoteToInProgressIfPublished — change | projectId: ${projectId}, from: published, to: in_progress`,
    );

    return ProjectStatus.IN_PROGRESS;
  }

  private computeDesiredStatus(drafts: number, skills: number, consultants: number): ProjectStatus {
    if (drafts === 0 || consultants === 0 || skills === 0) {
      return ProjectStatus.DRAFT;
    }
    return ProjectStatus.CONFIGURED;
  }
}
