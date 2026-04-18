import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Domain 4 — Tasks
// Creates: tasks, task_disputes, task_history, task_comments, task_comment_attachments
// Schema fixes applied:
//   §H1  optimistic lock via TypeORM @VersionColumn (column + auto-managed by ORM)
//   §H3  trg_log_task_change auto-writes task_history from OLD/NEW
//   §H4  trg_clear_task_assignment nulls assigned_to/assigned_at on status='to_do'
//   §H5  trg_sync_task_dispute_status flips tasks.kanban_status on dispute open/resolve
//   §H6  trg_lock_platform_fee_rate refuses platform_fee_rate change after pending_approval
//   §H9  CHECK price > 0 OR kanban_status='draft' (drafts allowed without price)
export class Domain4Tasks1713398700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- tasks ----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'tasks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_tasks',
          },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'title', type: 'varchar', length: '300', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'price',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'platform_fee_rate',
            type: 'numeric',
            precision: 5,
            scale: 4,
            isNullable: false,
            default: 0.1,
          },
          {
            name: 'platform_fee_amount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            generatedType: 'STORED',
            asExpression: 'ROUND(price * platform_fee_rate, 2)',
          },
          {
            name: 'consultant_payout',
            type: 'numeric',
            precision: 10,
            scale: 2,
            generatedType: 'STORED',
            asExpression: 'ROUND(price - (price * platform_fee_rate), 2)',
          },
          {
            name: 'difficulty_level',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'medium'`,
          },
          {
            name: 'creation_mode',
            type: 'varchar',
            length: '15',
            isNullable: false,
            default: `'manual'`,
          },
          {
            name: 'kanban_status',
            type: 'varchar',
            length: '25',
            isNullable: false,
            default: `'draft'`,
          },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'assigned_at', type: 'timestamptz', isNullable: true },
          { name: 'approved_by', type: 'uuid', isNullable: true },
          { name: 'approved_at', type: 'timestamptz', isNullable: true },
          { name: 'billing_period_id', type: 'uuid', isNullable: true },
          { name: 'display_order', type: 'int', isNullable: false, default: 0 },
          { name: 'version', type: 'int', isNullable: false, default: 1 },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_tasks_kanban_status',
            expression: `"kanban_status" IN ('draft','to_do','assigned','in_progress','in_review','pending_approval','revision_requested','disputed','done','cancelled')`,
          },
          {
            name: 'ck_tasks_difficulty_level',
            expression: `"difficulty_level" IN ('easy','medium','hard','expert')`,
          },
          {
            name: 'ck_tasks_creation_mode',
            expression: `"creation_mode" IN ('manual','ai_assisted')`,
          },
          {
            name: 'ck_tasks_platform_fee_rate',
            expression: `"platform_fee_rate" BETWEEN 0 AND 1`,
          },
          // §H9 — drafts may have price = 0; everything else requires price > 0.
          {
            name: 'ck_tasks_price_for_published',
            expression: `"kanban_status" = 'draft' OR "price" > 0`,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_tasks_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_tasks_to_consultant_profiles',
            columnNames: ['assigned_to'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_tasks_approved_by_to_users',
            columnNames: ['approved_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'idx_tasks_project_status',
        columnNames: ['project_id', 'kanban_status'],
      }),
    );

    await queryRunner.query(
      `CREATE INDEX "idx_tasks_assigned_to" ON "tasks" ("assigned_to") WHERE "assigned_to" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_tasks_billing_period" ON "tasks" ("billing_period_id")`,
    );

    // Unique display_order per project (excluding cancelled tasks).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tasks_display_order_active" ON "tasks" ("project_id", "display_order") WHERE "kanban_status" != 'cancelled'`,
    );

    // --- task_disputes -------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'task_disputes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_task_disputes',
          },
          { name: 'task_id', type: 'uuid', isNullable: false },
          { name: 'opened_by', type: 'uuid', isNullable: false },
          { name: 'reason', type: 'text', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '25',
            isNullable: false,
            default: `'open'`,
          },
          { name: 'resolution_note', type: 'text', isNullable: true },
          { name: 'resolved_by', type: 'uuid', isNullable: true },
          { name: 'opened_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
          { name: 'resolved_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_task_disputes_status',
            expression: `"status" IN ('open','resolved_approved','resolved_rejected','cancelled')`,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_task_disputes_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_task_disputes_opened_by_to_users',
            columnNames: ['opened_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_task_disputes_resolved_by_to_users',
            columnNames: ['resolved_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'task_disputes',
      new TableIndex({
        name: 'idx_task_disputes_task_id',
        columnNames: ['task_id'],
      }),
    );

    await queryRunner.query(
      `CREATE INDEX "idx_task_disputes_open" ON "task_disputes" ("status") WHERE "status" = 'open'`,
    );

    // --- task_history (append-only) ------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'task_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_task_history',
          },
          { name: 'task_id', type: 'uuid', isNullable: false },
          { name: 'previous_kanban_status', type: 'varchar', length: '25', isNullable: true },
          { name: 'new_kanban_status', type: 'varchar', length: '25', isNullable: true },
          { name: 'previous_assigned_to', type: 'uuid', isNullable: true },
          { name: 'new_assigned_to', type: 'uuid', isNullable: true },
          { name: 'changed_by', type: 'uuid', isNullable: true },
          { name: 'change_type', type: 'varchar', length: '30', isNullable: false },
          { name: 'note', type: 'text', isNullable: true },
          { name: 'changed_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
        ],
        checks: [
          {
            name: 'ck_task_history_change_type',
            expression: `"change_type" IN ('status_change','assignment','unassignment','approval','revision_requested','dispute_opened','dispute_resolved','edit','published','cancellation')`,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_task_history_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_task_history_prev_assignee_to_consultant_profiles',
            columnNames: ['previous_assigned_to'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_task_history_new_assignee_to_consultant_profiles',
            columnNames: ['new_assigned_to'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_task_history_changed_by_to_users',
            columnNames: ['changed_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_task_history_task_id" ON "task_history" ("task_id", "changed_at" DESC)`,
    );

    // --- task_comments -------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'task_comments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_task_comments',
          },
          { name: 'task_id', type: 'uuid', isNullable: false },
          { name: 'author_id', type: 'uuid', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          { name: 'is_edited', type: 'boolean', isNullable: false, default: false },
          { name: 'edited_at', type: 'timestamptz', isNullable: true },
          { name: 'is_deleted', type: 'boolean', isNullable: false, default: false },
          ...auditColumns(),
        ],
        foreignKeys: [
          {
            name: 'fk_task_comments_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_task_comments_to_users',
            columnNames: ['author_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_task_comments_task_id" ON "task_comments" ("task_id") WHERE "is_deleted" = FALSE`,
    );

    // --- task_comment_attachments --------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'task_comment_attachments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_task_comment_attachments',
          },
          { name: 'comment_id', type: 'uuid', isNullable: false },
          { name: 'file_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'file_url', type: 'text', isNullable: false },
          { name: 'file_size_bytes', type: 'bigint', isNullable: true },
          { name: 'mime_type', type: 'varchar', length: '100', isNullable: true },
          { name: 'uploaded_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
        ],
        foreignKeys: [
          {
            name: 'fk_task_comment_attachments_to_task_comments',
            columnNames: ['comment_id'],
            referencedTableName: 'task_comments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // --- triggers ------------------------------------------------------------

    // §H4 — when status reverts to to_do, clear assignment metadata.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION clear_task_assignment_on_todo()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.kanban_status = 'to_do' AND OLD.kanban_status != 'to_do' THEN
              NEW.assigned_to := NULL;
              NEW.assigned_at := NULL;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_clear_task_assignment
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION clear_task_assignment_on_todo();
    `);

    // §H6 — refuse platform_fee_rate change after pending_approval.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION lock_platform_fee_rate()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.platform_fee_rate IS DISTINCT FROM NEW.platform_fee_rate
             AND OLD.kanban_status IN ('pending_approval','done') THEN
              RAISE EXCEPTION
                'platform_fee_rate is locked once task reaches pending_approval (current status: %)',
                OLD.kanban_status;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_lock_platform_fee_rate
        BEFORE UPDATE OF platform_fee_rate ON tasks
        FOR EACH ROW EXECUTE FUNCTION lock_platform_fee_rate();
    `);

    // §H3 — auto-write task_history from OLD/NEW.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION log_task_change()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.kanban_status IS DISTINCT FROM NEW.kanban_status
             OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
              INSERT INTO task_history (
                  task_id, previous_kanban_status, new_kanban_status,
                  previous_assigned_to, new_assigned_to, changed_by, change_type
              )
              VALUES (
                  NEW.id, OLD.kanban_status, NEW.kanban_status,
                  OLD.assigned_to, NEW.assigned_to, NEW.updated_by,
                  CASE
                      WHEN OLD.kanban_status IS DISTINCT FROM NEW.kanban_status THEN 'status_change'
                      ELSE 'assignment'
                  END
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_log_task_change
        AFTER UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION log_task_change();
    `);

    // §H5 — opening/resolving a dispute flips task.kanban_status.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_task_dispute_status()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
              UPDATE tasks SET kanban_status = 'disputed' WHERE id = NEW.task_id;
          ELSIF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status != 'open' THEN
              CASE NEW.status
                  WHEN 'resolved_approved' THEN
                      UPDATE tasks SET kanban_status = 'done', approved_at = NOW()
                       WHERE id = NEW.task_id;
                  WHEN 'resolved_rejected' THEN
                      UPDATE tasks SET kanban_status = 'revision_requested'
                       WHERE id = NEW.task_id;
                  WHEN 'cancelled' THEN
                      UPDATE tasks SET kanban_status = 'pending_approval'
                       WHERE id = NEW.task_id;
                  ELSE NULL;
              END CASE;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_sync_task_dispute_status
        AFTER INSERT OR UPDATE ON task_disputes
        FOR EACH ROW EXECUTE FUNCTION sync_task_dispute_status();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_sync_task_dispute_status ON task_disputes`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_log_task_change ON tasks`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_lock_platform_fee_rate ON tasks`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_clear_task_assignment ON tasks`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_task_dispute_status()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS log_task_change()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS lock_platform_fee_rate()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS clear_task_assignment_on_todo()`);
    await queryRunner.dropTable('task_comment_attachments', true);
    await queryRunner.dropTable('task_comments', true);
    await queryRunner.dropTable('task_history', true);
    await queryRunner.dropTable('task_disputes', true);
    await queryRunner.dropTable('tasks', true);
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
