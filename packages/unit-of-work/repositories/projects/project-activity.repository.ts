import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  ActivityType,
  IActivityEventRow,
  IProjectActivityRepository,
} from './interfaces/project-activity.repository.interface';

// `?types=` value → LIKE pattern on the unioned `event_type` column.
const TYPE_PATTERNS: Record<ActivityType, string> = {
  task: 'task\\_%',
  member: 'member\\_%',
  project: 'project\\_%',
};

/**
 * Activity feed for a single project. Implemented as a hand-written CTE
 * because the feed unions three heterogeneous tables (task_history,
 * project_members, project_status_history) into a single sortable+pageable
 * stream — TypeORM's query builder can't express UNION ALL cleanly so we
 * drop to raw SQL and keep it isolated here.
 *
 * The CTE materialises every event row first, then a second SELECT applies
 * the optional `types` LIKE filter and pagination. A separate `COUNT(*)`
 * over the same CTE returns `total_events`.
 */
@Injectable()
export class ProjectActivityRepository implements IProjectActivityRepository {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  public withManager(manager: EntityManager): this {
    return new ProjectActivityRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findEventsByProjectId(
    projectId: string,
    skip: number,
    take: number,
    types?: ActivityType[],
  ): Promise<[IActivityEventRow[], number]> {
    const eventsCte = this.buildEventsCte();
    const patterns = types && types.length > 0 ? types.map((t) => TYPE_PATTERNS[t]) : null;
    const filterClause = patterns
      ? `WHERE EXISTS (SELECT 1 FROM unnest($2::text[]) AS p WHERE e.event_type LIKE p ESCAPE '\\\\')`
      : '';

    const pageParams: Array<string | string[] | number> = [projectId];
    if (patterns) pageParams.push(patterns);
    const takeIdx = pageParams.length + 1;
    const skipIdx = takeIdx + 1;
    pageParams.push(take, skip);

    const pageSql = `
      ${eventsCte}
      SELECT e.event_type, e.event_id, e.occurred_at, e.payload,
             u.id AS actor_user_id,
             COALESCE(bp.company_name, cp.full_name) AS actor_name
      FROM events e
      LEFT JOIN users u ON u.id = e.actor_id
      LEFT JOIN business_profiles bp ON bp.user_id = u.id
      LEFT JOIN consultant_profiles cp ON cp.user_id = u.id
      ${filterClause}
      ORDER BY e.occurred_at DESC, e.event_id
      LIMIT $${takeIdx} OFFSET $${skipIdx};
    `;

    const countParams: Array<string | string[]> = [projectId];
    if (patterns) countParams.push(patterns);
    const countSql = `${eventsCte} SELECT COUNT(*)::int AS total FROM events e ${filterClause};`;

    const [rows, countResult] = await Promise.all([
      this.manager.query<
        Array<{
          event_type: string;
          event_id: string;
          occurred_at: Date;
          actor_user_id: string | null;
          actor_name: string | null;
          payload: Record<string, unknown>;
        }>
      >(pageSql, pageParams),
      this.manager.query<Array<{ total: number }>>(countSql, countParams),
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    return [
      rows.map((r) => ({ ...r, event_type: r.event_type as IActivityEventRow['event_type'] })),
      total,
    ];
  }

  /**
   * Returns the `WITH events AS (...)` CTE shared by both the page query and
   * the COUNT query. Keeping it as a single string avoids drift between the
   * two — they MUST match for `total_events` to be accurate.
   */
  private buildEventsCte(): string {
    return `
      WITH events AS (
        -- task_status_changed: any TaskHistory row whose kanban status changed.
        SELECT 'task_status_changed'::text AS event_type,
               th.id AS event_id,
               th.changed_at AS occurred_at,
               th.changed_by AS actor_id,
               jsonb_build_object(
                 'task_id',     th.task_id,
                 'task_name',   t.title,
                 'from_status', th.previous_kanban_status,
                 'to_status',   th.new_kanban_status
               ) AS payload
        FROM task_history th
        JOIN tasks t ON t.id = th.task_id
        WHERE t.project_id = $1
          AND th.previous_kanban_status IS DISTINCT FROM th.new_kanban_status

        UNION ALL

        -- member_joined: only ACTIVE members (removed/left rows aren't surfaced).
        SELECT 'member_joined'::text,
               pm.id,
               pm.joined_at,
               cp.user_id,
               jsonb_build_object(
                 'member_id',       pm.id,
                 'consultant_id',   pm.consultant_id,
                 'consultant_name', cp.full_name
               )
        FROM project_members pm
        JOIN consultant_profiles cp ON cp.id = pm.consultant_id
        WHERE pm.project_id = $1 AND pm.status = 'active'

        UNION ALL

        -- project_status_changed: every row in project_status_history. Populated
        -- by the trg_log_project_status_change trigger on UPDATE projects.status.
        SELECT 'project_status_changed'::text,
               psh.id,
               psh.changed_at,
               psh.changed_by,
               jsonb_build_object(
                 'from_status', psh.previous_status,
                 'to_status',   psh.new_status
               )
        FROM project_status_history psh
        WHERE psh.project_id = $1
      )
    `;
  }
}
