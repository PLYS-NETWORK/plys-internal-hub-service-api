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
  application: 'application\\_%',
  member: 'member\\_%',
};

/**
 * Activity feed for a single project. Implemented as a hand-written CTE
 * because the feed unions four heterogeneous tables (task_history,
 * project_applications×2, project_members) into a single sortable+pageable
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

    // Page query — params: $1=projectId, [$2=patterns when filtering], then take/skip.
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

        -- application_received: every project_applications row at applied_at.
        SELECT 'application_received'::text,
               pa.id,
               pa.applied_at,
               NULL::uuid,
               jsonb_build_object(
                 'application_id',             pa.id,
                 'consultant_id',              pa.consultant_id,
                 'consultant_name',            cp.full_name,
                 'has_answered_all_questions', (
                   SELECT COALESCE((
                     SELECT COUNT(*) FROM project_interview_questions q
                     WHERE q.project_id = pa.project_id AND q.is_required = true
                   ) = 0 OR (
                     SELECT COUNT(DISTINCT ia.question_id)
                     FROM interview_answers ia
                     JOIN project_interview_questions q2 ON q2.id = ia.question_id
                     WHERE ia.application_id = pa.id AND q2.is_required = true
                   ) >= (
                     SELECT COUNT(*) FROM project_interview_questions q3
                     WHERE q3.project_id = pa.project_id AND q3.is_required = true
                   ), false)
                 )
               )
        FROM project_applications pa
        JOIN consultant_profiles cp ON cp.id = pa.consultant_id
        WHERE pa.project_id = $1

        UNION ALL

        -- application_approved/rejected: split by status, both keyed on reviewed_at.
        SELECT CASE WHEN pa.status = 'accepted' THEN 'application_approved'
                    ELSE 'application_rejected' END,
               pa.id,
               pa.reviewed_at,
               pa.reviewed_by,
               jsonb_build_object(
                 'application_id',  pa.id,
                 'consultant_id',   pa.consultant_id,
                 'consultant_name', cp.full_name
               )
        FROM project_applications pa
        JOIN consultant_profiles cp ON cp.id = pa.consultant_id
        WHERE pa.project_id = $1
          AND pa.reviewed_at IS NOT NULL
          AND pa.status IN ('accepted', 'rejected')

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
      )
    `;
  }
}
