import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Domain 7 — Notifications
// Creates: notifications (FK to invoices added in Domain 8)
// Schema fixes applied:
//   §C1   no inline FK to invoices — added later in Domain 8 as ALTER TABLE
export class Domain7Notifications1713399000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_notifications',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '60', isNullable: false },
          { name: 'title', type: 'varchar', length: '255', isNullable: false },
          { name: 'body', type: 'text', isNullable: true },
          { name: 'is_read', type: 'boolean', isNullable: false, default: false },
          { name: 'read_at', type: 'timestamptz', isNullable: true },
          { name: 'ref_project_id', type: 'uuid', isNullable: true },
          { name: 'ref_task_id', type: 'uuid', isNullable: true },
          { name: 'ref_app_id', type: 'uuid', isNullable: true },
          { name: 'ref_invoice_id', type: 'uuid', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
          { name: 'created_by', type: 'uuid', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'fk_notifications_to_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_notifications_to_projects',
            columnNames: ['ref_project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_notifications_to_tasks',
            columnNames: ['ref_task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_notifications_to_project_applications',
            columnNames: ['ref_app_id'],
            referencedTableName: 'project_applications',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'idx_notifications_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_unread" ON "notifications" ("user_id", "created_at" DESC) WHERE "is_read" = FALSE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications', true);
  }
}
