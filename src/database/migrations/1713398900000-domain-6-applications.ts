import { MigrationInterface, QueryRunner, Table } from 'typeorm';

// Domain 6 — Applications & Screening
// Creates: screening_questions, screening_question_choices, project_applications,
//          application_answers, application_answer_choices, project_members
// Triggers/functions:
//   trg_lock_screening_questions_*    §C6 race-fix using FOR SHARE row lock
//   trg_enforce_consultant_project_limit  §C5 race-fix using FOR UPDATE on consultant row
// Schema fixes applied:
//   §M3   project_applications partial unique index — re-apply after rejection
//   §H5   application_answers.question_text_snapshot
export class Domain6Applications1713398900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- screening_questions -------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'screening_questions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_screening_questions',
          },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'question_text', type: 'text', isNullable: false },
          {
            name: 'question_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'text'`,
          },
          { name: 'is_required', type: 'boolean', isNullable: false, default: true },
          { name: 'display_order', type: 'smallint', isNullable: false, default: 0 },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_screening_questions_question_type',
            expression: `"question_type" IN ('text','single_choice','multiple_choice','rating')`,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_screening_questions_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // --- screening_question_choices -----------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'screening_question_choices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_screening_question_choices',
          },
          { name: 'question_id', type: 'uuid', isNullable: false },
          { name: 'choice_text', type: 'varchar', length: '300', isNullable: false },
          { name: 'display_order', type: 'smallint', isNullable: false, default: 0 },
          ...traceColumns(),
        ],
        foreignKeys: [
          {
            name: 'fk_screening_question_choices_to_screening_questions',
            columnNames: ['question_id'],
            referencedTableName: 'screening_questions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // §C6 race-fix — lock projects.status row before checking it.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION lock_screening_questions_when_published()
      RETURNS TRIGGER AS $$
      DECLARE
          proj_status VARCHAR(20);
          target_project_id UUID := COALESCE(OLD.project_id, NEW.project_id);
      BEGIN
          SELECT status INTO proj_status
            FROM projects
           WHERE id = target_project_id
             FOR SHARE;

          IF proj_status NOT IN ('draft','setting_up','configured') THEN
              RAISE EXCEPTION
                'Screening questions cannot be modified after the project is published (current status: %)',
                proj_status;
          END IF;
          RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_lock_screening_questions_update
        BEFORE UPDATE ON screening_questions
        FOR EACH ROW EXECUTE FUNCTION lock_screening_questions_when_published();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_lock_screening_questions_delete
        BEFORE DELETE ON screening_questions
        FOR EACH ROW EXECUTE FUNCTION lock_screening_questions_when_published();
    `);

    // --- project_applications ------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'project_applications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_project_applications',
          },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'consultant_id', type: 'uuid', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'pending'`,
          },
          { name: 'cover_letter', type: 'text', isNullable: true },
          {
            name: 'proposed_rate',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          { name: 'reviewed_by', type: 'uuid', isNullable: true },
          { name: 'reviewed_at', type: 'timestamptz', isNullable: true },
          { name: 'rejection_reason', type: 'text', isNullable: true },
          { name: 'applied_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_project_applications_status',
            expression: `"status" IN ('pending','accepted','rejected','withdrawn')`,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_project_applications_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_project_applications_to_consultant_profiles',
            columnNames: ['consultant_id'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_project_applications_reviewed_by_to_users',
            columnNames: ['reviewed_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    // §M3 — only one active application per (project, consultant)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_project_applications_one_active" ON "project_applications" ("project_id", "consultant_id") WHERE "status" IN ('pending','accepted')`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_project_status" ON "project_applications" ("project_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_consultant_id" ON "project_applications" ("consultant_id")`,
    );

    // --- application_answers -------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'application_answers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_application_answers',
          },
          { name: 'application_id', type: 'uuid', isNullable: false },
          { name: 'question_id', type: 'uuid', isNullable: false },
          { name: 'question_text_snapshot', type: 'text', isNullable: false },
          { name: 'answer_text', type: 'text', isNullable: true },
          ...traceColumns(),
        ],
        uniques: [
          {
            name: 'uq_application_answers_application_question',
            columnNames: ['application_id', 'question_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_application_answers_to_project_applications',
            columnNames: ['application_id'],
            referencedTableName: 'project_applications',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_application_answers_to_screening_questions',
            columnNames: ['question_id'],
            referencedTableName: 'screening_questions',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // --- application_answer_choices -----------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'application_answer_choices',
        columns: [
          { name: 'answer_id', type: 'uuid', isNullable: false, isPrimary: true },
          { name: 'choice_id', type: 'uuid', isNullable: false, isPrimary: true },
          ...traceColumns(),
        ],
        foreignKeys: [
          {
            name: 'fk_application_answer_choices_to_application_answers',
            columnNames: ['answer_id'],
            referencedTableName: 'application_answers',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_application_answer_choices_to_screening_question_choices',
            columnNames: ['choice_id'],
            referencedTableName: 'screening_question_choices',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // --- project_members -----------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'project_members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_project_members',
          },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'consultant_id', type: 'uuid', isNullable: false },
          { name: 'application_id', type: 'uuid', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'active'`,
          },
          { name: 'joined_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
          { name: 'left_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_project_members_status',
            expression: `"status" IN ('active','removed','left')`,
          },
        ],
        uniques: [
          {
            name: 'uq_project_members_project_consultant',
            columnNames: ['project_id', 'consultant_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_project_members_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_project_members_to_consultant_profiles',
            columnNames: ['consultant_id'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_project_members_to_project_applications',
            columnNames: ['application_id'],
            referencedTableName: 'project_applications',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_project_members_project_id" ON "project_members" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_project_members_consultant_id" ON "project_members" ("consultant_id")`,
    );

    // §C5 — race-free max_concurrent_projects enforcement.
    // Lock the consultant's row first, then count active memberships.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_consultant_project_limit()
      RETURNS TRIGGER AS $$
      DECLARE
          current_count INT;
          max_allowed   INT;
      BEGIN
          SELECT max_concurrent_projects INTO max_allowed
            FROM consultant_profiles
           WHERE id = NEW.consultant_id
             FOR UPDATE;

          SELECT COUNT(*) INTO current_count
            FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
           WHERE pm.consultant_id = NEW.consultant_id
             AND pm.status = 'active'
             AND p.status IN ('public','in_progress');

          IF current_count >= max_allowed THEN
              RAISE EXCEPTION
                'Consultant has reached their maximum of % concurrent active projects',
                max_allowed;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_enforce_consultant_project_limit
        BEFORE INSERT ON project_members
        FOR EACH ROW EXECUTE FUNCTION enforce_consultant_project_limit();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_enforce_consultant_project_limit ON project_members`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_consultant_project_limit()`);
    await queryRunner.dropTable('project_members', true);
    await queryRunner.dropTable('application_answer_choices', true);
    await queryRunner.dropTable('application_answers', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_project_applications_one_active"`);
    await queryRunner.dropTable('project_applications', true);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_lock_screening_questions_delete ON screening_questions`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_lock_screening_questions_update ON screening_questions`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS lock_screening_questions_when_published()`);
    await queryRunner.dropTable('screening_question_choices', true);
    await queryRunner.dropTable('screening_questions', true);
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
