import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Board refactor migration. Combines four schema changes that ship together
 * because the new business board view depends on all of them at once:
 *
 *   1. Add `tasks.started_at` / `tasks.completed_at` for time tracking,
 *      backfilled from `task_history`.
 *   2. Rename `task_evidences` → `task_results` and
 *      `task_evidence_attachments` → `task_result_attachments` (incl.
 *      column `evidence_id` → `result_id`, plus every PK/FK/INDEX name
 *      to keep the `_table_column` convention truthful).
 *   3. Replace `files.purpose = 'task_evidence'` with `'task_result'`.
 *   4. Create the new `task_attachments` table for task-level briefs /
 *      reference files (separate from the consultant-uploaded results).
 */
export class RefactorBoardEvidenceToResultAndTaskAttachments20260506000004 implements MigrationInterface {
  public readonly name = 'RefactorBoardEvidenceToResultAndTaskAttachments20260506000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. tasks.started_at / completed_at
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN "started_at"   timestamptz NULL,
        ADD COLUMN "completed_at" timestamptz NULL
    `);
    await queryRunner.query(`CREATE INDEX "idx_tasks_started_at"   ON "tasks" ("started_at")`);
    await queryRunner.query(`CREATE INDEX "idx_tasks_completed_at" ON "tasks" ("completed_at")`);

    // Best-effort backfill from task_history. `task_history` is append-only
    // so this is safe to re-run if the migration is rolled back and re-applied.
    await queryRunner.query(`
      UPDATE "tasks" t
         SET "started_at" = sub.first_in_progress
        FROM (
          SELECT task_id, MIN(changed_at) AS first_in_progress
            FROM "task_history"
           WHERE new_kanban_status = 'in_progress'
           GROUP BY task_id
        ) sub
       WHERE sub.task_id = t.id
         AND t.started_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE "tasks" t
         SET "completed_at" = sub.last_done
        FROM (
          SELECT task_id, MAX(changed_at) AS last_done
            FROM "task_history"
           WHERE new_kanban_status = 'done'
           GROUP BY task_id
        ) sub
       WHERE sub.task_id = t.id
         AND t.completed_at IS NULL
         AND t.kanban_status = 'done'
    `);

    // 2. Rename task_evidences → task_results
    await queryRunner.query(`ALTER TABLE "task_evidences" RENAME TO "task_results"`);
    await queryRunner.query(
      `ALTER TABLE "task_results" RENAME CONSTRAINT "pk_task_evidences" TO "pk_task_results"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_results" RENAME CONSTRAINT "fk_task_evidences_to_tasks" TO "fk_task_results_to_tasks"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_results" RENAME CONSTRAINT "fk_task_evidences_to_users" TO "fk_task_results_to_users"`,
    );
    await queryRunner.query(
      `ALTER INDEX "idx_task_evidences_task_id"   RENAME TO "idx_task_results_task_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "idx_task_evidences_author_id" RENAME TO "idx_task_results_author_id"`,
    );

    // Rename task_evidence_attachments → task_result_attachments
    await queryRunner.query(
      `ALTER TABLE "task_evidence_attachments" RENAME TO "task_result_attachments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME COLUMN "evidence_id" TO "result_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME CONSTRAINT "pk_task_evidence_attachments" TO "pk_task_result_attachments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME CONSTRAINT "fk_task_evidence_attachments_to_task_evidences" TO "fk_task_result_attachments_to_task_results"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME CONSTRAINT "fk_task_evidence_attachments_to_files" TO "fk_task_result_attachments_to_files"`,
    );
    await queryRunner.query(
      `ALTER INDEX "idx_task_evidence_attachments_evidence_id" RENAME TO "idx_task_result_attachments_result_id"`,
    );

    // 3. files.purpose value rename
    await queryRunner.query(
      `UPDATE "files" SET "purpose" = 'task_result' WHERE "purpose" = 'task_evidence'`,
    );

    // 4. New task_attachments table
    await queryRunner.query(`
      CREATE TABLE "task_attachments" (
        "id"               uuid        NOT NULL DEFAULT gen_random_uuid(),
        "task_id"          uuid        NOT NULL,
        "file_id"          uuid        NULL,
        "file_name"        varchar(255) NOT NULL,
        "file_url"         text        NOT NULL,
        "file_size_bytes"  bigint      NULL,
        "mime_type"        varchar(100) NULL,
        "uploaded_at"      timestamptz NOT NULL DEFAULT now(),
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        "deleted_at"       timestamptz NULL,
        "created_by"       uuid        NULL,
        "updated_by"       uuid        NULL,
        "deleted_by"       uuid        NULL,
        CONSTRAINT "pk_task_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_attachments_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_attachments_to_files"
          FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_attachments_task_id" ON "task_attachments" ("task_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 4. drop task_attachments
    await queryRunner.query(`DROP TABLE IF EXISTS "task_attachments" CASCADE`);

    // 3. revert files.purpose
    await queryRunner.query(
      `UPDATE "files" SET "purpose" = 'task_evidence' WHERE "purpose" = 'task_result'`,
    );

    // 2. revert task_result_attachments → task_evidence_attachments
    await queryRunner.query(
      `ALTER INDEX "idx_task_result_attachments_result_id" RENAME TO "idx_task_evidence_attachments_evidence_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME CONSTRAINT "fk_task_result_attachments_to_files" TO "fk_task_evidence_attachments_to_files"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME CONSTRAINT "fk_task_result_attachments_to_task_results" TO "fk_task_evidence_attachments_to_task_evidences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME CONSTRAINT "pk_task_result_attachments" TO "pk_task_evidence_attachments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME COLUMN "result_id" TO "evidence_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_result_attachments" RENAME TO "task_evidence_attachments"`,
    );

    // revert task_results → task_evidences
    await queryRunner.query(
      `ALTER INDEX "idx_task_results_author_id" RENAME TO "idx_task_evidences_author_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "idx_task_results_task_id"   RENAME TO "idx_task_evidences_task_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_results" RENAME CONSTRAINT "fk_task_results_to_users" TO "fk_task_evidences_to_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_results" RENAME CONSTRAINT "fk_task_results_to_tasks" TO "fk_task_evidences_to_tasks"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_results" RENAME CONSTRAINT "pk_task_results" TO "pk_task_evidences"`,
    );
    await queryRunner.query(`ALTER TABLE "task_results" RENAME TO "task_evidences"`);

    // 1. drop tasks.started_at / completed_at
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_completed_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_started_at"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "completed_at", DROP COLUMN IF EXISTS "started_at"`,
    );
  }
}
