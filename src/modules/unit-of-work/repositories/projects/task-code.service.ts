import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ITaskCodeAllocation, ITaskCodeService } from './interfaces/task-code.service.interface';

/**
 * Allocates per-project task codes (`<projects.code>-<N>`) using a
 * Postgres transaction-scoped advisory lock keyed on `('tasks:code', projectId)`.
 * Mirrors the design of `TransactionNumberService` — see that file for the
 * rationale around advisory-lock vs counter-table.
 *
 * The service relies on `MAX(code_seq) + 1` (not `COUNT(*)`) so soft-deleted
 * tasks still consume their slot, satisfying the "never reused" runtime
 * requirement: a task numbered `WEB-3` that is later soft-deleted will not
 * have its code reissued to a new task.
 *
 * Use through `txUow.taskCodes` inside a `withTransaction` callback so the
 * advisory lock and the subsequent INSERT participate in the same xact.
 */
@Injectable()
export class TaskCodeService implements ITaskCodeService {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
  ) {}

  public withManager(manager: EntityManager): TaskCodeService {
    return new TaskCodeService(manager);
  }

  /** @inheritdoc */
  public async next(projectId: string, projectCode: string): Promise<ITaskCodeAllocation> {
    // Two-int advisory lock keyed by ('tasks:code', projectId). Reentrant on
    // the same xact and auto-released on commit/rollback.
    await this.manager.query(
      `SELECT pg_advisory_xact_lock(hashtext($1)::int4, hashtext($2)::int4)`,
      ['tasks:code', projectId],
    );

    const rows = (await this.manager.query(
      `SELECT COALESCE(MAX(code_seq), 0) + 1 AS n FROM tasks WHERE project_id = $1`,
      [projectId],
    )) as Array<{ n: number }>;
    const codeSeq = Number(rows[0]?.n ?? 1);

    return { codeSeq, code: `${projectCode}-${codeSeq}` };
  }
}
