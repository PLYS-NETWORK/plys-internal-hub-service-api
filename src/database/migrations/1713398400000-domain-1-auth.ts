import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Domain 1 — Auth & Identity
// Creates: users, auth_tokens, user_sso_providers, user_sessions
// Applies schema fixes:
//   §C7  users.email uniqueness is case-insensitive via functional index on LOWER(email)
//   §H10 user_sessions cleanup index — not the cleanup itself (that's a pg_cron job TODO)
export class Domain1Auth1713398400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // --- users ----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_users',
          },
          { name: 'email', type: 'varchar', length: '255', isNullable: false },
          { name: 'password_hash', type: 'text', isNullable: true },
          {
            name: 'is_email_verified',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          { name: 'email_verified_at', type: 'timestamptz', isNullable: true },
          {
            name: 'is_active',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          { name: 'last_login_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
      }),
      true,
    );

    // §C7 case-insensitive email uniqueness
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_email_lower" ON "users" (LOWER(email))`,
    );

    // --- auth_tokens ----------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'auth_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_auth_tokens',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '30', isNullable: false },
          { name: 'token_hash', type: 'text', isNullable: false },
          { name: 'expires_at', type: 'timestamptz', isNullable: false },
          { name: 'used_at', type: 'timestamptz', isNullable: true },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_auth_tokens_type',
            expression: `"type" IN ('email_verification','password_reset','magic_link')`,
          },
        ],
        uniques: [{ name: 'uq_auth_tokens_token_hash', columnNames: ['token_hash'] }],
        foreignKeys: [
          {
            name: 'fk_auth_tokens_to_users',
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
      'auth_tokens',
      new TableIndex({
        name: 'idx_auth_tokens_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Partial index — only unused tokens are worth scanning by expiry.
    await queryRunner.query(
      `CREATE INDEX "idx_auth_tokens_type_expires" ON "auth_tokens" ("type", "expires_at") WHERE "used_at" IS NULL`,
    );

    // --- user_sso_providers ---------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'user_sso_providers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_user_sso_providers',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'provider', type: 'varchar', length: '50', isNullable: false },
          {
            name: 'provider_user_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'provider_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'access_token', type: 'text', isNullable: true },
          { name: 'refresh_token', type: 'text', isNullable: true },
          { name: 'token_expires_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        uniques: [
          {
            name: 'uq_user_sso_providers_provider_identity',
            columnNames: ['provider', 'provider_user_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_user_sso_providers_to_users',
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
      'user_sso_providers',
      new TableIndex({
        name: 'idx_user_sso_providers_user_id',
        columnNames: ['user_id'],
      }),
    );

    // --- user_sessions --------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'user_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_user_sessions',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'session_token', type: 'text', isNullable: false },
          {
            name: 'active_platform',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          { name: 'ip_address', type: 'inet', isNullable: true },
          { name: 'user_agent', type: 'text', isNullable: true },
          { name: 'expires_at', type: 'timestamptz', isNullable: false },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_user_sessions_active_platform',
            expression: `"active_platform" IN ('business','consultant')`,
          },
        ],
        uniques: [
          {
            name: 'uq_user_sessions_session_token',
            columnNames: ['session_token'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_user_sessions_to_users',
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
      'user_sessions',
      new TableIndex({
        name: 'idx_user_sessions_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({
        name: 'idx_user_sessions_expires_at',
        columnNames: ['expires_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_sessions', true);
    await queryRunner.dropTable('user_sso_providers', true);
    await queryRunner.dropTable('auth_tokens', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email_lower"`);
    await queryRunner.dropTable('users', true);
  }
}

// AuditableEntity columns — see src/database/entities/base/auditable.entity.ts.
// Audit values are populated by AuditSubscriber (src/database/subscribers).
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

// TraceableEntity columns — for append-only tables.
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
