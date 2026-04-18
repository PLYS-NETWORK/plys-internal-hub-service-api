import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Domain 3 — Projects
// Creates: projects, project_required_skills, project_status_history
// Triggers/functions:
//   trg_enforce_project_status         status transition guard
//   trg_enforce_project_hiring_mode    hiring_mode auto-toggle + lifecycle stamps
//   trg_log_project_status_change      §H3 — auto-write project_status_history
// Schema fixes applied:
//   §H7  status→in_progress requires at least required_consultants active members
export class Domain3Projects1713398600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- projects -------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'projects',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_projects',
          },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'title', type: 'varchar', length: '300', isNullable: false },
          { name: 'introduction', type: 'text', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'draft'`,
          },
          { name: 'hiring_mode', type: 'boolean', isNullable: false, default: false },
          {
            name: 'required_consultants',
            type: 'smallint',
            isNullable: false,
            default: 1,
          },
          {
            name: 'budget_min',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'budget_max',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          { name: 'published_at', type: 'timestamptz', isNullable: true },
          { name: 'started_at', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'cancelled_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_projects_status',
            expression: `"status" IN ('draft','setting_up','configured','public','in_progress','done','cancelled')`,
          },
          {
            name: 'ck_projects_required_consultants',
            expression: `"required_consultants" >= 1`,
          },
          {
            name: 'ck_projects_budget_range',
            expression: `"budget_min" IS NULL OR "budget_max" IS NULL OR "budget_max" >= "budget_min"`,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_projects_to_business_profiles',
            columnNames: ['business_id'],
            referencedTableName: 'business_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'projects',
      new TableIndex({
        name: 'idx_projects_business_id',
        columnNames: ['business_id'],
      }),
    );

    await queryRunner.createIndex(
      'projects',
      new TableIndex({
        name: 'idx_projects_status',
        columnNames: ['status'],
      }),
    );

    // Partial index — list of open hiring projects is a hot read path.
    await queryRunner.query(
      `CREATE INDEX "idx_projects_hiring_open" ON "projects" ("hiring_mode", "status") WHERE "hiring_mode" = TRUE AND "status" IN ('public','in_progress')`,
    );

    // --- project_required_skills ---------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'project_required_skills',
        columns: [
          { name: 'project_id', type: 'uuid', isNullable: false, isPrimary: true },
          { name: 'skill_id', type: 'uuid', isNullable: false, isPrimary: true },
          {
            name: 'is_mandatory',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          ...traceColumns(),
        ],
        foreignKeys: [
          {
            name: 'fk_project_required_skills_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_project_required_skills_to_skills',
            columnNames: ['skill_id'],
            referencedTableName: 'skills',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'project_required_skills',
      new TableIndex({
        name: 'idx_project_required_skills_skill_id',
        columnNames: ['skill_id'],
      }),
    );

    // --- project_status_history (append-only audit) --------------------------
    await queryRunner.createTable(
      new Table({
        name: 'project_status_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_project_status_history',
          },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'previous_status', type: 'varchar', length: '20', isNullable: true },
          { name: 'new_status', type: 'varchar', length: '20', isNullable: false },
          { name: 'changed_by', type: 'uuid', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
          { name: 'changed_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
        ],
        foreignKeys: [
          {
            name: 'fk_project_status_history_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_project_status_history_to_users',
            columnNames: ['changed_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'project_status_history',
      new TableIndex({
        name: 'idx_project_status_history_project_id',
        columnNames: ['project_id'],
      }),
    );

    // --- triggers / functions ------------------------------------------------

    // Enforce valid project status transitions.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_project_status_transition()
      RETURNS TRIGGER AS $$
      DECLARE
          allowed JSONB := '{
              "draft":       ["setting_up", "cancelled"],
              "setting_up":  ["draft", "configured", "cancelled"],
              "configured":  ["setting_up", "public", "in_progress", "cancelled"],
              "public":      ["configured", "in_progress", "cancelled"],
              "in_progress": ["done", "cancelled"],
              "done":        [],
              "cancelled":   []
          }';
          active_members INT;
      BEGIN
          IF OLD.status = NEW.status THEN RETURN NEW; END IF;

          IF NOT (allowed->OLD.status @> to_jsonb(NEW.status)) THEN
              RAISE EXCEPTION 'Invalid project status transition: % -> %. Allowed from %: %',
                  OLD.status, NEW.status, OLD.status, allowed->OLD.status;
          END IF;

          -- §H7 require enough members before activating
          IF NEW.status = 'in_progress' THEN
              SELECT COUNT(*) INTO active_members
                FROM project_members
               WHERE project_id = NEW.id AND status = 'active';
              IF active_members < NEW.required_consultants THEN
                  RAISE EXCEPTION 'Cannot move project to in_progress: have % active member(s), required %',
                      active_members, NEW.required_consultants;
              END IF;
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_enforce_project_status
        BEFORE UPDATE OF status ON projects
        FOR EACH ROW EXECUTE FUNCTION enforce_project_status_transition();
    `);

    // Auto-manage hiring_mode + lifecycle timestamps on status change.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_project_hiring_mode()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.status = 'public' THEN
              NEW.hiring_mode := TRUE;
          ELSIF NEW.status NOT IN ('public', 'in_progress') THEN
              NEW.hiring_mode := FALSE;
          END IF;

          IF NEW.status = 'public'      AND OLD.status != 'public'      THEN NEW.published_at  := NOW(); END IF;
          IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN NEW.started_at    := NOW(); END IF;
          IF NEW.status = 'done'        AND OLD.status != 'done'        THEN NEW.completed_at  := NOW(); END IF;
          IF NEW.status = 'cancelled'   AND OLD.status != 'cancelled'   THEN NEW.cancelled_at  := NOW(); END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_enforce_project_hiring_mode
        BEFORE UPDATE OF status ON projects
        FOR EACH ROW EXECUTE FUNCTION enforce_project_hiring_mode();
    `);

    // §H3 — auto-write history rows from OLD/NEW values.
    // updated_by is populated by AuditSubscriber and reflects the acting user.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION log_project_status_change()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.status IS DISTINCT FROM NEW.status THEN
              INSERT INTO project_status_history (project_id, previous_status, new_status, changed_by)
              VALUES (NEW.id, OLD.status, NEW.status, NEW.updated_by);
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_log_project_status_change
        AFTER UPDATE OF status ON projects
        FOR EACH ROW EXECUTE FUNCTION log_project_status_change();
    `);

    // Insert initial 'draft' history row at create time.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION log_project_status_create()
      RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO project_status_history (project_id, previous_status, new_status, changed_by)
          VALUES (NEW.id, NULL, NEW.status, NEW.created_by);
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_log_project_status_create
        AFTER INSERT ON projects
        FOR EACH ROW EXECUTE FUNCTION log_project_status_create();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_log_project_status_create ON projects`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_log_project_status_change ON projects`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_enforce_project_hiring_mode ON projects`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_enforce_project_status ON projects`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS log_project_status_create()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS log_project_status_change()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_project_hiring_mode()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_project_status_transition()`);
    await queryRunner.dropTable('project_status_history', true);
    await queryRunner.dropTable('project_required_skills', true);
    await queryRunner.dropTable('projects', true);
  }
}

function auditColumns(): {
  name: string;
  type: string;
  isNullable: boolean;
  default?: string;
}[] {
  return [
    { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
    { name: 'deleted_at', type: 'timestamptz', isNullable: true },
    { name: 'created_by', type: 'uuid', isNullable: true },
    { name: 'updated_by', type: 'uuid', isNullable: true },
    { name: 'deleted_by', type: 'uuid', isNullable: true },
  ];
}

function traceColumns(): {
  name: string;
  type: string;
  isNullable: boolean;
  default?: string;
}[] {
  return [
    { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
    { name: 'created_by', type: 'uuid', isNullable: true },
  ];
}
