import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectStatusHistory20260430000001 implements MigrationInterface {
  public readonly name = 'AddProjectStatusHistory20260430000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Append-only audit log of every projects.status change. Powers the
    // project_status_changed arm of the activity-feed CTE without forcing
    // every status-changing code path to remember to write a row.
    await queryRunner.query(`
      CREATE TABLE "project_status_history" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"      UUID          NOT NULL,
        "previous_status" VARCHAR(20),
        "new_status"      VARCHAR(20)   NOT NULL,
        "changed_by"      UUID,
        "changed_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_project_status_history" PRIMARY KEY ("id"),
        CONSTRAINT "fk_project_status_history_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_project_status_history_changed_by_to_users"
          FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_project_status_history_project_id" ON "project_status_history" ("project_id", "changed_at")`,
    );

    // Trigger function — runs after every UPDATE to projects.status. NEW.updated_by
    // is the audit-column id of whoever made the change, sourced from the existing
    // AuditableEntity instrumentation in TypeORM.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trg_log_project_status_change()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO project_status_history (project_id, previous_status, new_status, changed_by)
          VALUES (NEW.id, OLD.status, NEW.status, NEW.updated_by);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_log_project_status_change
        AFTER UPDATE OF status ON projects
        FOR EACH ROW
        EXECUTE FUNCTION trg_log_project_status_change()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_log_project_status_change ON projects`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS trg_log_project_status_change()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_status_history" CASCADE`);
  }
}
