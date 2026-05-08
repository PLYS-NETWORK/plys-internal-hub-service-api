import { Task } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

import { LogDecisionDto, UpdateDerivedContextDto } from '../dto/requests';
import { AiContextResponseDto } from '../dto/responses';

// Compact projection of a task stored on `project_ai_context.task_index`. The
// BE owns every field except `summary`, which the FE fills in via the
// derived-write endpoint.
export interface ITaskIndexEntry extends Record<string, unknown> {
  id: string;
  title: string;
  price: string;
  kanban_status: string;
  summary: string | null;
}

export interface IProjectAiContextService {
  /**
   * Lazily creates the `project_ai_context` row when missing. Used by the
   * chat session module on first session create so a context exists by the
   * time the next bootstrap runs.
   *
   * @param tx Active unit of work — caller controls the surrounding tx so
   *   create is atomic with the triggering write.
   * @param projectId Project to ensure context for.
   */
  ensureExists(tx: IUnitOfWork, projectId: string): Promise<void>;

  /**
   * Upserts a task entry on `task_index`. Preserves the existing `summary`
   * when patching an entry that already has one. Flips `needs_reindex=true`
   * when the entry is new — the FE will pick up the flag on the next
   * bootstrap and POST a fresh summary.
   *
   * @param tx Active unit of work.
   * @param projectId Owning project.
   * @param task Task to patch into the index.
   */
  patchTaskInIndex(tx: IUnitOfWork, projectId: string, task: Task): Promise<void>;

  /**
   * Removes the matching entries from `task_index`. Bulk variant — single
   * row write regardless of input size. Flips `needs_reindex=true` so the
   * FE re-derives `domain` / `conventions` after large deletes.
   *
   * @param tx Active unit of work.
   * @param projectId Owning project.
   * @param taskIds Task IDs to drop.
   */
  removeManyFromIndex(tx: IUnitOfWork, projectId: string, taskIds: string[]): Promise<void>;

  /**
   * Returns the full context row. 404 if no row exists yet.
   * Surfaced through the admin debug endpoint and used by the bootstrap
   * service.
   *
   * @throws TranslatableException 404 AI_CONTEXT_NOT_FOUND.
   */
  getContext(projectId: string): Promise<AiContextResponseDto>;

  /**
   * Appends an audit decision to the JSONB array. Lazily creates the row
   * if missing.
   */
  logDecision(projectId: string, dto: LogDecisionDto): Promise<AiContextResponseDto>;

  /**
   * Merges the FE-derived fields into the row, appends a `derived_write`
   * audit decision, clears `needs_reindex`, and stamps `last_indexed_at`.
   * Lazily creates the row if missing.
   */
  updateDerived(projectId: string, dto: UpdateDerivedContextDto): Promise<AiContextResponseDto>;
}
