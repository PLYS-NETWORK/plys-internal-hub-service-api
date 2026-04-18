import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Domain 5 — AI-Assisted Task Creation
// Creates: ai_task_sessions, ai_session_messages
// Schema fixes applied:
//   §M2  partial unique index — one active session per (project, user)
//   §M4  unique (session_id, message_order)
export class Domain5Ai1713398800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_task_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_ai_task_sessions',
          },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'title', type: 'varchar', length: '255', isNullable: true },
          { name: 'is_active', type: 'boolean', isNullable: false, default: true },
          ...auditColumns(),
        ],
        foreignKeys: [
          {
            name: 'fk_ai_task_sessions_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_ai_task_sessions_to_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ai_task_sessions',
      new TableIndex({
        name: 'idx_ai_sessions_project_user',
        columnNames: ['project_id', 'user_id'],
      }),
    );

    // §M2 — only one active session per (project, user)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_ai_sessions_one_active" ON "ai_task_sessions" ("project_id", "user_id") WHERE "is_active" = TRUE`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_session_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_ai_session_messages',
          },
          { name: 'session_id', type: 'uuid', isNullable: false },
          { name: 'role', type: 'varchar', length: '10', isNullable: false },
          { name: 'content', type: 'text', isNullable: false },
          { name: 'linked_task_id', type: 'uuid', isNullable: true },
          { name: 'token_count', type: 'int', isNullable: true },
          { name: 'message_order', type: 'int', isNullable: false },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_ai_session_messages_role',
            expression: `"role" IN ('user','assistant','system')`,
          },
        ],
        uniques: [
          {
            name: 'uq_ai_session_messages_session_order',
            columnNames: ['session_id', 'message_order'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_ai_session_messages_to_ai_task_sessions',
            columnNames: ['session_id'],
            referencedTableName: 'ai_task_sessions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_ai_session_messages_to_tasks',
            columnNames: ['linked_task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ai_session_messages',
      new TableIndex({
        name: 'idx_ai_messages_session_order',
        columnNames: ['session_id', 'message_order'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ai_session_messages', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_ai_sessions_one_active"`);
    await queryRunner.dropTable('ai_task_sessions', true);
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
