import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces human-readable identifiers and per-status ordering invariants:
 *
 *   - `projects.code`            — uppercase A-Z/0-9 slug, unique per business.
 *   - `tasks.code` + `code_seq`  — `[projects.code]-[code_seq]` (e.g. WEB-1).
 *                                  `code_seq` is project-scoped and never reused
 *                                  (uses MAX(code_seq) + 1 via advisory lock).
 *   - `tasks.display_order`      — now unique within (project_id, kanban_status)
 *                                  for non-deleted rows. The board UI drives
 *                                  positioning per column, not project-globally.
 *
 * Existing rows are deterministically backfilled by `created_at` rank so the
 * migration is replayable in staging and produces stable codes.
 */
export class AddProjectAndTaskCodes20260501000002 implements MigrationInterface {
  public readonly name = 'AddProjectAndTaskCodes20260501000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── projects.code ─────────────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "projects" ADD COLUMN "code" VARCHAR(8) NULL`);

    // Backfill: P001, P002, … per business_id ordered by (created_at, id).
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               'P' || LPAD(
                 ROW_NUMBER() OVER (
                   PARTITION BY business_id ORDER BY created_at, id
                 )::text,
                 3, '0'
               ) AS new_code
          FROM projects
      )
      UPDATE projects p
         SET code = r.new_code
        FROM ranked r
       WHERE p.id = r.id
    `);

    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "code" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_projects_business_code" ON "projects" ("business_id", "code")`,
    );

    // ─── tasks.code + tasks.code_seq ───────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "code_seq" INT NULL`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "code" VARCHAR(20) NULL`);

    // Backfill: per-project sequential, ordered by (created_at, id). Soft-deleted
    // tasks consume their N too, matching the "never reused" runtime semantics.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT t.id,
               ROW_NUMBER() OVER (
                 PARTITION BY t.project_id ORDER BY t.created_at, t.id
               ) AS seq,
               p.code AS project_code
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
      )
      UPDATE tasks t
         SET code_seq = r.seq,
             code     = r.project_code || '-' || r.seq
        FROM ranked r
       WHERE t.id = r.id
    `);

    await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "code_seq" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "code" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tasks_project_code_seq" ON "tasks" ("project_id", "code_seq")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_tasks_code" ON "tasks" ("code")`);

    // ─── display_order: renumber per (project_id, kanban_status) ───────────
    // Existing data has globally-numbered display_order; we renumber so it is
    // contiguous and unique within each column (excluding soft-deleted rows).
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY project_id, kanban_status
                 ORDER BY display_order, created_at, id
               ) AS new_order
          FROM tasks
         WHERE deleted_at IS NULL
      )
      UPDATE tasks t
         SET display_order = r.new_order
        FROM ranked r
       WHERE t.id = r.id
    `);

    // Partial unique index — enforces the per-column ordering invariant for
    // live tasks. Soft-deleted rows are exempt so ressurecting one cannot
    // collide with the live row that took its slot.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tasks_project_status_order" ON "tasks" ` +
        `("project_id", "kanban_status", "display_order") WHERE deleted_at IS NULL`,
    );

    // Replace the older (project_id, kanban_status) index with the wider
    // (project_id, kanban_status, display_order) covering index — the board
    // listing query orders by display_order so this removes the Sort step.
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_project_status"`);
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_project_status_order" ON "tasks" ` +
        `("project_id", "kanban_status", "display_order")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_project_status_order"`);
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_project_status" ON "tasks" ("project_id", "kanban_status")`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_tasks_project_status_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_tasks_project_code_seq"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "code"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "code_seq"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_projects_business_code"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "code"`);
  }
}
