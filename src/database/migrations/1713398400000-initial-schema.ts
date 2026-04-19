import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Consolidated initial schema — all 8 domains in one migration.
//
// SQL FUNCTIONS and TRIGGERS that previously enforced business rules at the
// database level have been removed. Those rules are now enforced in application
// code (services) to keep business logic visible, testable, and maintainable:
//
//   Removed function                        → Replaced by
//   ─────────────────────────────────────── ─────────────────────────────────
//   enforce_project_status_transition()     ProjectsService — status guard
//   enforce_project_hiring_mode()           ProjectsService — hiring_mode + timestamps
//   log_project_status_change/create()      ProjectsService — writes ProjectStatusHistory
//   clear_task_assignment_on_todo()         TasksService — clears assigned_to on revert
//   lock_platform_fee_rate()                TasksService — guards fee rate mutation
//   log_task_change()                       TasksService — writes TaskHistory
//   sync_task_dispute_status()              TaskDisputesService — flips task status
//   lock_screening_questions_when_published() ScreeningQuestionsService — status guard
//   enforce_consultant_project_limit()      ProjectMembersService — concurrency guard
//   get_or_create_billing_period()          BillingService — upsert billing period
//   sync_wallet_balance_on_transaction()    WalletService — updates wallet balances
//
// The v_wallet_balance_audit view is kept — it is a read-only SELECT used for
// operations monitoring only; it does not encode business logic.
export class InitialSchema1713398400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ─── Domain 1 — Auth & Identity ─────────────────────────────────────────

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
          { name: 'is_email_verified', type: 'boolean', isNullable: false, default: false },
          { name: 'email_verified_at', type: 'timestamptz', isNullable: true },
          { name: 'is_active', type: 'boolean', isNullable: false, default: true },
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
      new TableIndex({ name: 'idx_auth_tokens_user_id', columnNames: ['user_id'] }),
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
          { name: 'provider_user_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'provider_email', type: 'varchar', length: '255', isNullable: true },
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
      new TableIndex({ name: 'idx_user_sso_providers_user_id', columnNames: ['user_id'] }),
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
          { name: 'active_platform', type: 'varchar', length: '20', isNullable: false },
          // device_id and fingerprint support device-binding for Seller/Admin sessions
          { name: 'device_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'fingerprint', type: 'text', isNullable: true },
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
        uniques: [{ name: 'uq_user_sessions_session_token', columnNames: ['session_token'] }],
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
      new TableIndex({ name: 'idx_user_sessions_user_id', columnNames: ['user_id'] }),
    );
    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({ name: 'idx_user_sessions_expires_at', columnNames: ['expires_at'] }),
    );
    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({ name: 'idx_user_sessions_device_id', columnNames: ['device_id'] }),
    );

    // ─── Domain 2 — Profiles ────────────────────────────────────────────────

    // --- business_profiles ----------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'business_profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_business_profiles',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'company_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'industry', type: 'varchar', length: '100', isNullable: true },
          { name: 'company_size', type: 'varchar', length: '50', isNullable: true },
          { name: 'website_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'address_line1', type: 'varchar', length: '255', isNullable: true },
          { name: 'address_line2', type: 'varchar', length: '255', isNullable: true },
          { name: 'city', type: 'varchar', length: '100', isNullable: true },
          { name: 'state_province', type: 'varchar', length: '100', isNullable: true },
          { name: 'postal_code', type: 'varchar', length: '20', isNullable: true },
          { name: 'country_code', type: 'char', length: '2', isNullable: true },
          { name: 'phone_number', type: 'varchar', length: '30', isNullable: true },
          { name: 'logo_url', type: 'text', isNullable: true },
          { name: 'is_verified', type: 'boolean', isNullable: false, default: false },
          ...auditColumns(),
        ],
        uniques: [{ name: 'uq_business_profiles_user_id', columnNames: ['user_id'] }],
        foreignKeys: [
          {
            name: 'fk_business_profiles_to_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // --- business_members -----------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'business_members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_business_members',
          },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'role', type: 'varchar', length: '20', isNullable: false, default: `'viewer'` },
          { name: 'invited_by', type: 'uuid', isNullable: true },
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
            name: 'ck_business_members_role',
            expression: `"role" IN ('owner','admin','manager','billing','viewer')`,
          },
          {
            name: 'ck_business_members_status',
            expression: `"status" IN ('active','suspended','left')`,
          },
        ],
        uniques: [
          {
            name: 'uq_business_members_business_user',
            columnNames: ['business_id', 'user_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_business_members_to_business_profiles',
            columnNames: ['business_id'],
            referencedTableName: 'business_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_business_members_to_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_business_members_invited_by_to_users',
            columnNames: ['invited_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'business_members',
      new TableIndex({ name: 'idx_business_members_business_id', columnNames: ['business_id'] }),
    );
    await queryRunner.createIndex(
      'business_members',
      new TableIndex({ name: 'idx_business_members_user_id', columnNames: ['user_id'] }),
    );

    // --- skills ---------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'skills',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_skills',
          },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'category', type: 'varchar', length: '100', isNullable: true },
          ...auditColumns(),
        ],
      }),
      true,
    );

    // §M1 — case-insensitive skill uniqueness
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_skills_name_lower" ON "skills" (LOWER(name))`,
    );

    // --- consultant_profiles --------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'consultant_profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_consultant_profiles',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'full_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'headline', type: 'varchar', length: '300', isNullable: true },
          { name: 'bio', type: 'text', isNullable: true },
          { name: 'years_of_experience', type: 'smallint', isNullable: true },
          {
            name: 'hourly_rate',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          { name: 'availability', type: 'varchar', length: '20', isNullable: true },
          {
            name: 'max_concurrent_projects',
            type: 'smallint',
            isNullable: false,
            default: 5,
          },
          { name: 'avatar_url', type: 'text', isNullable: true },
          { name: 'address_line1', type: 'varchar', length: '255', isNullable: true },
          { name: 'address_line2', type: 'varchar', length: '255', isNullable: true },
          { name: 'city', type: 'varchar', length: '100', isNullable: true },
          { name: 'state_province', type: 'varchar', length: '100', isNullable: true },
          { name: 'postal_code', type: 'varchar', length: '20', isNullable: true },
          { name: 'country_code', type: 'char', length: '2', isNullable: true },
          { name: 'phone_number', type: 'varchar', length: '30', isNullable: true },
          { name: 'is_verified', type: 'boolean', isNullable: false, default: false },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_consultant_profiles_years_of_experience',
            expression: `"years_of_experience" IS NULL OR "years_of_experience" >= 0`,
          },
          {
            name: 'ck_consultant_profiles_availability',
            expression: `"availability" IS NULL OR "availability" IN ('full_time','part_time','contract','unavailable')`,
          },
          {
            name: 'ck_consultant_profiles_max_concurrent_projects',
            expression: `"max_concurrent_projects" >= 1`,
          },
        ],
        uniques: [{ name: 'uq_consultant_profiles_user_id', columnNames: ['user_id'] }],
        foreignKeys: [
          {
            name: 'fk_consultant_profiles_to_users',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // --- consultant_skills (junction) ----------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'consultant_skills',
        columns: [
          { name: 'consultant_id', type: 'uuid', isNullable: false, isPrimary: true },
          { name: 'skill_id', type: 'uuid', isNullable: false, isPrimary: true },
          {
            name: 'proficiency_level',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'intermediate'`,
          },
          { name: 'years_with_skill', type: 'smallint', isNullable: true },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_consultant_skills_proficiency_level',
            expression: `"proficiency_level" IN ('beginner','intermediate','advanced','expert')`,
          },
          {
            name: 'ck_consultant_skills_years_with_skill',
            expression: `"years_with_skill" IS NULL OR "years_with_skill" >= 0`,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_consultant_skills_to_consultant_profiles',
            columnNames: ['consultant_id'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_consultant_skills_to_skills',
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
      'consultant_skills',
      new TableIndex({ name: 'idx_consultant_skills_skill_id', columnNames: ['skill_id'] }),
    );

    // ─── Domain 3 — Projects ────────────────────────────────────────────────

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
          { name: 'required_consultants', type: 'smallint', isNullable: false, default: 1 },
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
      new TableIndex({ name: 'idx_projects_business_id', columnNames: ['business_id'] }),
    );
    await queryRunner.createIndex(
      'projects',
      new TableIndex({ name: 'idx_projects_status', columnNames: ['status'] }),
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
          { name: 'is_mandatory', type: 'boolean', isNullable: false, default: true },
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

    // ─── Domain 4 — Tasks ───────────────────────────────────────────────────

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
      new TableIndex({ name: 'idx_task_disputes_task_id', columnNames: ['task_id'] }),
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

    // ─── Domain 5 — AI ──────────────────────────────────────────────────────

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

    // ─── Domain 6 — Applications & Screening ────────────────────────────────

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

    // ─── Domain 7 — Notifications ───────────────────────────────────────────

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
      new TableIndex({ name: 'idx_notifications_user_id', columnNames: ['user_id'] }),
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_unread" ON "notifications" ("user_id", "created_at" DESC) WHERE "is_read" = FALSE`,
    );

    // ─── Domain 8 — Finance ─────────────────────────────────────────────────

    // --- billing_periods ----------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'billing_periods',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_billing_periods',
          },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'period_start', type: 'date', isNullable: false },
          { name: 'period_end', type: 'date', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'open'`,
          },
          {
            name: 'total_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          { name: 'finalized_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_billing_periods_status',
            expression: `"status" IN ('open','finalized','invoiced','paid','overdue','disputed')`,
          },
          {
            name: 'ck_billing_periods_period_dates_valid',
            expression: `"period_end" >= "period_start"`,
          },
        ],
        uniques: [
          {
            name: 'uq_billing_periods_business_period_start',
            columnNames: ['business_id', 'period_start'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_billing_periods_to_business_profiles',
            columnNames: ['business_id'],
            referencedTableName: 'business_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_billing_periods_business_open" ON "billing_periods" ("business_id", "status") WHERE "status" IN ('open','finalized')`,
    );

    // Deferred FK from Domain 4: tasks.billing_period_id → billing_periods.id
    await queryRunner.query(`
      ALTER TABLE tasks
        ADD CONSTRAINT fk_tasks_to_billing_periods
        FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id) ON DELETE SET NULL
    `);

    // --- invoices -----------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_invoices',
          },
          { name: 'billing_period_id', type: 'uuid', isNullable: false },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'amount', type: 'numeric', precision: 12, scale: 2, isNullable: false },
          { name: 'currency', type: 'char', length: '3', isNullable: false, default: `'USD'` },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'pending'`,
          },
          { name: 'processor_name', type: 'varchar', length: '50', isNullable: true },
          { name: 'processor_invoice_id', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'processor_payment_intent_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'processor_payment_url', type: 'text', isNullable: true },
          { name: 'due_date', type: 'date', isNullable: true },
          { name: 'paid_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_invoices_status',
            expression: `"status" IN ('pending','paid','overdue','cancelled','refunded')`,
          },
        ],
        uniques: [
          { name: 'uq_invoices_billing_period_id', columnNames: ['billing_period_id'] },
          { name: 'uq_invoices_processor_invoice_id', columnNames: ['processor_invoice_id'] },
        ],
        foreignKeys: [
          {
            name: 'fk_invoices_to_billing_periods',
            columnNames: ['billing_period_id'],
            referencedTableName: 'billing_periods',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_invoices_to_business_profiles',
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
      'invoices',
      new TableIndex({ name: 'idx_invoices_business_id', columnNames: ['business_id'] }),
    );
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({ name: 'idx_invoices_status', columnNames: ['status'] }),
    );

    // §C1 — deferred FK: notifications.ref_invoice_id → invoices.id
    await queryRunner.query(`
      ALTER TABLE notifications
        ADD CONSTRAINT fk_notifications_to_invoices
        FOREIGN KEY (ref_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
    `);

    // --- invoice_line_items -------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'invoice_line_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_invoice_line_items',
          },
          { name: 'invoice_id', type: 'uuid', isNullable: false },
          { name: 'task_id', type: 'uuid', isNullable: false },
          { name: 'consultant_id', type: 'uuid', isNullable: false },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'currency', type: 'char', length: '3', isNullable: false, default: `'USD'` },
          { name: 'amount', type: 'numeric', precision: 10, scale: 2, isNullable: false },
          {
            name: 'platform_fee_amount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'consultant_payout',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_invoice_line_items_amount_split',
            expression: `"amount" = "platform_fee_amount" + "consultant_payout"`,
          },
        ],
        uniques: [
          {
            name: 'uq_invoice_line_items_invoice_task',
            columnNames: ['invoice_id', 'task_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_invoice_line_items_to_invoices',
            columnNames: ['invoice_id'],
            referencedTableName: 'invoices',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_invoice_line_items_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_invoice_line_items_to_consultant_profiles',
            columnNames: ['consultant_id'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_invoice_line_items_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items" ("invoice_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_consultant" ON "invoice_line_items" ("consultant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_task" ON "invoice_line_items" ("task_id")`,
    );

    // --- consultant_wallets -------------------------------------------------
    // §C2 — NO `>= 0` CHECK. Reversals can take cleared_balance negative.
    await queryRunner.createTable(
      new Table({
        name: 'consultant_wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_consultant_wallets',
          },
          { name: 'consultant_id', type: 'uuid', isNullable: false },
          {
            name: 'cleared_balance',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'pending_balance',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          { name: 'currency', type: 'char', length: '3', isNullable: false, default: `'USD'` },
          {
            name: 'total_earned',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'total_withdrawn',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          ...auditColumns(),
        ],
        uniques: [{ name: 'uq_consultant_wallets_consultant_id', columnNames: ['consultant_id'] }],
        foreignKeys: [
          {
            name: 'fk_consultant_wallets_to_consultant_profiles',
            columnNames: ['consultant_id'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // --- wallet_transactions ------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'wallet_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_wallet_transactions',
          },
          { name: 'wallet_id', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '20', isNullable: false },
          { name: 'amount', type: 'numeric', precision: 10, scale: 2, isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'completed'`,
          },
          { name: 'invoice_id', type: 'uuid', isNullable: true },
          { name: 'task_id', type: 'uuid', isNullable: true },
          { name: 'project_id', type: 'uuid', isNullable: true },
          { name: 'withdrawal_method', type: 'varchar', length: '50', isNullable: true },
          { name: 'withdrawal_reference', type: 'varchar', length: '255', isNullable: true },
          { name: 'processor_event_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_wallet_transactions_type',
            expression: `"type" IN ('credit_pending','credit_cleared','debit_pending','withdrawal','reversal')`,
          },
          {
            name: 'ck_wallet_transactions_status',
            expression: `"status" IN ('completed','pending','failed','reversed')`,
          },
          { name: 'ck_wallet_transactions_amount', expression: `"amount" > 0` },
        ],
        uniques: [
          {
            name: 'uq_wallet_transactions_processor_event_id',
            columnNames: ['processor_event_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_wallet_transactions_to_consultant_wallets',
            columnNames: ['wallet_id'],
            referencedTableName: 'consultant_wallets',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_wallet_transactions_to_invoices',
            columnNames: ['invoice_id'],
            referencedTableName: 'invoices',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_wallet_transactions_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_wallet_transactions_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_wallet_txn_wallet_created" ON "wallet_transactions" ("wallet_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wallet_txn_project" ON "wallet_transactions" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wallet_txn_task" ON "wallet_transactions" ("task_id")`,
    );

    // Audit view — flags drift between stored balance and ledger sum.
    // Read-only; does not encode business logic.
    await queryRunner.query(`
      CREATE OR REPLACE VIEW v_wallet_balance_audit AS
      SELECT
          w.id              AS wallet_id,
          w.consultant_id,
          w.cleared_balance AS stored_cleared,
          w.pending_balance AS stored_pending,
          COALESCE(SUM(CASE wt.type
              WHEN 'credit_cleared' THEN  wt.amount
              WHEN 'withdrawal'     THEN -wt.amount
              WHEN 'reversal'       THEN -wt.amount
              ELSE 0 END), 0) AS computed_cleared,
          COALESCE(SUM(CASE wt.type
              WHEN 'credit_pending' THEN  wt.amount
              WHEN 'debit_pending'  THEN -wt.amount
              ELSE 0 END), 0) AS computed_pending,
          w.cleared_balance - COALESCE(SUM(CASE wt.type
              WHEN 'credit_cleared' THEN  wt.amount
              WHEN 'withdrawal'     THEN -wt.amount
              WHEN 'reversal'       THEN -wt.amount
              ELSE 0 END), 0) AS cleared_drift,
          w.pending_balance - COALESCE(SUM(CASE wt.type
              WHEN 'credit_pending' THEN  wt.amount
              WHEN 'debit_pending'  THEN -wt.amount
              ELSE 0 END), 0) AS pending_drift
      FROM consultant_wallets w
      LEFT JOIN wallet_transactions wt
        ON wt.wallet_id = w.id AND wt.status = 'completed'
      GROUP BY w.id, w.consultant_id, w.cleared_balance, w.pending_balance
    `);

    // --- business_transactions ----------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'business_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_business_transactions',
          },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '25', isNullable: false },
          { name: 'amount', type: 'numeric', precision: 12, scale: 2, isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'completed'`,
          },
          { name: 'invoice_id', type: 'uuid', isNullable: true },
          { name: 'task_id', type: 'uuid', isNullable: true },
          { name: 'project_id', type: 'uuid', isNullable: true },
          { name: 'processor_event_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_business_transactions_type',
            expression: `"type" IN ('invoice_created','payment_received','refund_issued','dispute_opened','dispute_resolved')`,
          },
          {
            name: 'ck_business_transactions_status',
            expression: `"status" IN ('completed','pending','failed','reversed')`,
          },
        ],
        uniques: [
          {
            name: 'uq_business_transactions_processor_event_id',
            columnNames: ['processor_event_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_business_transactions_to_business_profiles',
            columnNames: ['business_id'],
            referencedTableName: 'business_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_business_transactions_to_invoices',
            columnNames: ['invoice_id'],
            referencedTableName: 'invoices',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_business_transactions_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_business_transactions_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_business_txn_business" ON "business_transactions" ("business_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_business_txn_project" ON "business_transactions" ("project_id")`,
    );

    // --- webhook_events -----------------------------------------------------
    // §C4 — UNIQUE on (processor, event_id), not event_id alone.
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_webhook_events',
          },
          { name: 'processor', type: 'varchar', length: '50', isNullable: false },
          { name: 'event_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'event_type', type: 'varchar', length: '100', isNullable: false },
          { name: 'payload', type: 'jsonb', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'pending'`,
          },
          { name: 'retry_count', type: 'smallint', isNullable: false, default: 0 },
          { name: 'next_retry_at', type: 'timestamptz', isNullable: true },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'processed_at', type: 'timestamptz', isNullable: true },
          { name: 'received_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
        ],
        checks: [
          {
            name: 'ck_webhook_events_status',
            expression: `"status" IN ('pending','processing','processed','failed','skipped')`,
          },
        ],
        uniques: [
          {
            name: 'uq_webhook_events_processor_event_id',
            columnNames: ['processor', 'event_id'],
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_webhook_events_retry" ON "webhook_events" ("next_retry_at") WHERE "status" IN ('pending','failed')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order
    await queryRunner.dropTable('webhook_events', true);
    await queryRunner.dropTable('business_transactions', true);
    await queryRunner.query(`DROP VIEW IF EXISTS v_wallet_balance_audit`);
    await queryRunner.dropTable('wallet_transactions', true);
    await queryRunner.dropTable('consultant_wallets', true);
    await queryRunner.query(
      `ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_to_invoices`,
    );
    await queryRunner.dropTable('invoice_line_items', true);
    await queryRunner.dropTable('invoices', true);
    await queryRunner.query(
      `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_to_billing_periods`,
    );
    await queryRunner.dropTable('billing_periods', true);
    await queryRunner.dropTable('notifications', true);
    await queryRunner.dropTable('project_members', true);
    await queryRunner.dropTable('application_answer_choices', true);
    await queryRunner.dropTable('application_answers', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_project_applications_one_active"`);
    await queryRunner.dropTable('project_applications', true);
    await queryRunner.dropTable('screening_question_choices', true);
    await queryRunner.dropTable('screening_questions', true);
    await queryRunner.dropTable('ai_session_messages', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_ai_sessions_one_active"`);
    await queryRunner.dropTable('ai_task_sessions', true);
    await queryRunner.dropTable('task_comment_attachments', true);
    await queryRunner.dropTable('task_comments', true);
    await queryRunner.dropTable('task_history', true);
    await queryRunner.dropTable('task_disputes', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_tasks_display_order_active"`);
    await queryRunner.dropTable('tasks', true);
    await queryRunner.dropTable('project_status_history', true);
    await queryRunner.dropTable('project_required_skills', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_hiring_open"`);
    await queryRunner.dropTable('projects', true);
    await queryRunner.dropTable('consultant_skills', true);
    await queryRunner.dropTable('consultant_profiles', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_skills_name_lower"`);
    await queryRunner.dropTable('skills', true);
    await queryRunner.dropTable('business_members', true);
    await queryRunner.dropTable('business_profiles', true);
    await queryRunner.dropTable('user_sessions', true);
    await queryRunner.dropTable('user_sso_providers', true);
    await queryRunner.dropTable('auth_tokens', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email_lower"`);
    await queryRunner.dropTable('users', true);
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
