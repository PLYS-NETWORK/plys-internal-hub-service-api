import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema20260429000001 implements MigrationInterface {
  public readonly name = 'InitSchema20260429000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── users ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
        "email"             VARCHAR(255)  NOT NULL,
        "platform"          VARCHAR(20)   NOT NULL,
        "password_hash"     TEXT,
        "is_email_verified" BOOLEAN       NOT NULL DEFAULT FALSE,
        "email_verified_at" TIMESTAMPTZ,
        "is_active"         BOOLEAN       NOT NULL DEFAULT TRUE,
        "last_login_at"     TIMESTAMPTZ,
        "role"              VARCHAR(20)   NOT NULL DEFAULT 'USER',
        "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        "created_by"        UUID,
        "updated_by"        UUID,
        "deleted_by"        UUID,
        CONSTRAINT "pk_users" PRIMARY KEY ("id")
      )
    `);
    // Functional unique index — same email per platform, case-insensitive.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_users_platform_email_lower"
        ON "users" ("platform", LOWER("email"))
    `);

    // ─── skills ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "skills" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "name"       VARCHAR(100)  NOT NULL,
        "category"   VARCHAR(100),
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        "created_by" UUID,
        "updated_by" UUID,
        "deleted_by" UUID,
        CONSTRAINT "pk_skills" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_skills_name_lower" ON "skills" (LOWER("name"))
    `);

    // ─── auth_tokens ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "auth_tokens" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    UUID          NOT NULL,
        "type"       VARCHAR(30)   NOT NULL,
        "token_hash" TEXT          NOT NULL,
        "expires_at" TIMESTAMPTZ   NOT NULL,
        "used_at"    TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by" UUID,
        CONSTRAINT "pk_auth_tokens"           PRIMARY KEY ("id"),
        CONSTRAINT "uq_auth_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "fk_auth_tokens_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_auth_tokens_user_id"       ON "auth_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_tokens_type_expires"  ON "auth_tokens" ("type", "expires_at")`,
    );

    // ─── user_sessions ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"        UUID          NOT NULL,
        "session_token"  TEXT          NOT NULL,
        "device_id"      VARCHAR(255),
        "fingerprint"    TEXT,
        "ip_address"     INET,
        "user_agent"     TEXT,
        "expires_at"     TIMESTAMPTZ   NOT NULL,
        "used_at"        TIMESTAMPTZ,
        "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"     TIMESTAMPTZ,
        "created_by"     UUID,
        "updated_by"     UUID,
        "deleted_by"     UUID,
        CONSTRAINT "pk_user_sessions"              PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_sessions_session_token" UNIQUE ("session_token"),
        CONSTRAINT "fk_user_sessions_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_user_id"        ON "user_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_expires_at"      ON "user_sessions" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_device_id"       ON "user_sessions" ("device_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_token_used_at"   ON "user_sessions" ("session_token", "used_at")`,
    );

    // ─── user_sso_providers ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_sso_providers" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"          UUID          NOT NULL,
        "platform"         VARCHAR(20)   NOT NULL,
        "provider"         VARCHAR(50)   NOT NULL,
        "provider_user_id" VARCHAR(255)  NOT NULL,
        "provider_email"   VARCHAR(255),
        "access_token"     TEXT,
        "refresh_token"    TEXT,
        "token_expires_at" TIMESTAMPTZ,
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        "created_by"       UUID,
        "updated_by"       UUID,
        "deleted_by"       UUID,
        CONSTRAINT "pk_user_sso_providers"                             PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_sso_providers_platform_provider_identity"  UNIQUE ("platform", "provider", "provider_user_id"),
        CONSTRAINT "fk_user_sso_providers_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_sso_providers_user_id" ON "user_sso_providers" ("user_id")`,
    );

    // ─── consultant_profiles ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_profiles" (
        "id"                        UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"                   UUID          NOT NULL,
        "full_name"                 VARCHAR(255)  NOT NULL,
        "bio"                       TEXT,
        "years_of_experience"       SMALLINT,
        "availability"              VARCHAR(20),
        "avatar_url"                TEXT,
        "address_line"              VARCHAR(255),
        "city"                      VARCHAR(100),
        "state_province"            VARCHAR(100),
        "postal_code"               VARCHAR(20),
        "country_code"              CHAR(2),
        "phone_number"              VARCHAR(30),
        "is_verified"               BOOLEAN       NOT NULL DEFAULT FALSE,
        "account_balance"           NUMERIC(15,2) NOT NULL DEFAULT 0,
        "stripe_connect_account_id" VARCHAR(255),
        "created_at"                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"                TIMESTAMPTZ,
        "created_by"                UUID,
        "updated_by"                UUID,
        "deleted_by"                UUID,
        CONSTRAINT "pk_consultant_profiles"          PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_profiles_user_id"  UNIQUE ("user_id"),
        CONSTRAINT "fk_consultant_profiles_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // ─── business_profiles ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "business_profiles" (
        "id"                        UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"                   UUID          NOT NULL,
        "company_name"              VARCHAR(255)  NOT NULL,
        "industry"                  VARCHAR(100),
        "company_size"              VARCHAR(50),
        "website_url"               VARCHAR(500),
        "description"               TEXT,
        "address_line"              VARCHAR(255),
        "city"                      VARCHAR(100),
        "state_province"            VARCHAR(100),
        "postal_code"               VARCHAR(20),
        "country_code"              CHAR(2),
        "phone_number"              VARCHAR(30),
        "logo_url"                  TEXT,
        "is_verified"               BOOLEAN       NOT NULL DEFAULT FALSE,
        "is_partner_platform"       BOOLEAN       NOT NULL DEFAULT FALSE,
        "allow_payment_credit"      BOOLEAN       NOT NULL DEFAULT FALSE,
        "account_balance"           NUMERIC(15,2) NOT NULL DEFAULT 0,
        "stripe_connect_account_id" VARCHAR(255),
        "commission_rate"           NUMERIC(5,4)  NOT NULL DEFAULT 0.25,
        "created_at"                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"                TIMESTAMPTZ,
        "created_by"                UUID,
        "updated_by"                UUID,
        "deleted_by"                UUID,
        CONSTRAINT "pk_business_profiles"         PRIMARY KEY ("id"),
        CONSTRAINT "uq_business_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "fk_business_profiles_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // ─── files ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "files" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "owner_user_id"    UUID          NOT NULL,
        "storage_provider" VARCHAR(16)   NOT NULL,
        "storage_key"      TEXT          NOT NULL,
        "original_name"    TEXT          NOT NULL,
        "mime_type"        VARCHAR(127)  NOT NULL,
        "size_bytes"       BIGINT        NOT NULL,
        "sha256"           CHAR(64),
        "purpose"          VARCHAR(64),
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        "created_by"       UUID,
        "updated_by"       UUID,
        "deleted_by"       UUID,
        CONSTRAINT "pk_files"          PRIMARY KEY ("id"),
        CONSTRAINT "fk_files_to_users"
          FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_files_storage_key"    ON "files" ("storage_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_files_owner_user_id"        ON "files" ("owner_user_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_files_purpose"              ON "files" ("purpose")`);
    await queryRunner.query(
      `CREATE INDEX "idx_files_deleted_at"           ON "files" ("deleted_at")`,
    );

    // ─── consultant_skills ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_skills" (
        "consultant_id"    UUID          NOT NULL,
        "skill_id"         UUID          NOT NULL,
        "proficiency_level" VARCHAR(20)  NOT NULL DEFAULT 'intermediate',
        "years_with_skill" SMALLINT,
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"       UUID,
        CONSTRAINT "pk_consultant_skills" PRIMARY KEY ("consultant_id", "skill_id"),
        CONSTRAINT "fk_consultant_skills_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_skills_to_skills"
          FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_skills_skill_id" ON "consultant_skills" ("skill_id")`,
    );

    // ─── projects ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"                   UUID          NOT NULL DEFAULT gen_random_uuid(),
        "business_id"          UUID          NOT NULL,
        "title"                VARCHAR(300)  NOT NULL,
        "introduction"         JSONB,
        "status"               VARCHAR(20)   NOT NULL DEFAULT 'draft',
        "required_consultants" SMALLINT      NOT NULL DEFAULT 1,
        "published_at"         TIMESTAMPTZ,
        "started_at"           TIMESTAMPTZ,
        "completed_at"         TIMESTAMPTZ,
        "cancelled_at"         TIMESTAMPTZ,
        "created_at"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"           TIMESTAMPTZ,
        "created_by"           UUID,
        "updated_by"           UUID,
        "deleted_by"           UUID,
        CONSTRAINT "pk_projects" PRIMARY KEY ("id"),
        CONSTRAINT "fk_projects_to_business_profiles"
          FOREIGN KEY ("business_id") REFERENCES "business_profiles" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_projects_business_id"           ON "projects" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_projects_status"                ON "projects" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_projects_status_published_at"   ON "projects" ("status", "published_at")`,
    );

    // ─── project_required_skills ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_required_skills" (
        "project_id" UUID        NOT NULL,
        "skill_id"   UUID        NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_by" UUID,
        CONSTRAINT "pk_project_required_skills" PRIMARY KEY ("project_id", "skill_id"),
        CONSTRAINT "fk_project_required_skills_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_project_required_skills_to_skills"
          FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_project_required_skills_skill_id" ON "project_required_skills" ("skill_id")`,
    );

    // ─── project_interview_questions ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_interview_questions" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"    UUID          NOT NULL,
        "question_text" TEXT          NOT NULL,
        "display_order" SMALLINT      NOT NULL DEFAULT 1,
        "is_required"   BOOLEAN       NOT NULL DEFAULT TRUE,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_by"    UUID,
        CONSTRAINT "pk_project_interview_questions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_project_interview_questions_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_project_interview_questions_project_id" ON "project_interview_questions" ("project_id")`,
    );

    // ─── project_applications ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_applications" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"       UUID          NOT NULL,
        "consultant_id"    UUID          NOT NULL,
        "status"           VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "cover_letter"     TEXT,
        "reviewed_by"      UUID,
        "reviewed_at"      TIMESTAMPTZ,
        "rejection_reason" TEXT,
        "applied_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        "created_by"       UUID,
        "updated_by"       UUID,
        "deleted_by"       UUID,
        CONSTRAINT "pk_project_applications" PRIMARY KEY ("id"),
        CONSTRAINT "fk_project_applications_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_applications_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_applications_reviewed_by_to_users"
          FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_applications_project_status"  ON "project_applications" ("project_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_consultant_id"   ON "project_applications" ("consultant_id")`,
    );
    // Only one active (pending or accepted) application per consultant per project.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_applications_project_consultant_active"
        ON "project_applications" ("project_id", "consultant_id")
        WHERE "status" IN ('pending', 'accepted')
    `);

    // ─── project_members ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"     UUID          NOT NULL,
        "consultant_id"  UUID          NOT NULL,
        "application_id" UUID          NOT NULL,
        "status"         VARCHAR(20)   NOT NULL DEFAULT 'active',
        "joined_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "left_at"        TIMESTAMPTZ,
        "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"     TIMESTAMPTZ,
        "created_by"     UUID,
        "updated_by"     UUID,
        "deleted_by"     UUID,
        CONSTRAINT "pk_project_members"                      PRIMARY KEY ("id"),
        CONSTRAINT "uq_project_members_project_consultant"   UNIQUE ("project_id", "consultant_id"),
        CONSTRAINT "fk_project_members_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_members_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_members_to_project_applications"
          FOREIGN KEY ("application_id") REFERENCES "project_applications" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_project_members_project_id"    ON "project_members" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_project_members_consultant_id" ON "project_members" ("consultant_id")`,
    );

    // ─── interview_answers ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "interview_answers" (
        "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
        "application_id"         UUID        NOT NULL,
        "question_id"            UUID        NOT NULL,
        "question_text_snapshot" TEXT        NOT NULL,
        "answer"                 JSONB       NOT NULL,
        "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_by"             UUID,
        CONSTRAINT "pk_interview_answers"                          PRIMARY KEY ("id"),
        CONSTRAINT "uq_interview_answers_application_question"     UNIQUE ("application_id", "question_id"),
        CONSTRAINT "fk_interview_answers_to_project_applications"
          FOREIGN KEY ("application_id") REFERENCES "project_applications" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_interview_answers_to_project_interview_questions"
          FOREIGN KEY ("question_id") REFERENCES "project_interview_questions" ("id") ON DELETE RESTRICT
      )
    `);

    // ─── ai_task_sessions ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_task_sessions" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id" UUID          NOT NULL,
        "user_id"    UUID          NOT NULL,
        "title"      VARCHAR(255),
        "is_active"  BOOLEAN       NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        "created_by" UUID,
        "updated_by" UUID,
        "deleted_by" UUID,
        CONSTRAINT "pk_ai_task_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_ai_task_sessions_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_ai_task_sessions_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ai_sessions_project_user" ON "ai_task_sessions" ("project_id", "user_id")`,
    );
    // Only one active session per (project, user).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_ai_sessions_active_per_project_user"
        ON "ai_task_sessions" ("project_id", "user_id")
        WHERE "is_active" = TRUE
    `);

    // ─── billing_periods ──────────────────────────────────────────────────────
    // Created before tasks so the billing_period_id FK can be declared inline.
    await queryRunner.query(`
      CREATE TABLE "billing_periods" (
        "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
        "business_id"  UUID          NOT NULL,
        "period_start" DATE          NOT NULL,
        "period_end"   DATE          NOT NULL,
        "status"       VARCHAR(20)   NOT NULL DEFAULT 'open',
        "total_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "finalized_at" TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        "created_by"   UUID,
        "updated_by"   UUID,
        "deleted_by"   UUID,
        CONSTRAINT "pk_billing_periods"                        PRIMARY KEY ("id"),
        CONSTRAINT "uq_billing_periods_business_period_start"  UNIQUE ("business_id", "period_start"),
        CONSTRAINT "ck_billing_periods_period_dates_valid"      CHECK ("period_end" >= "period_start"),
        CONSTRAINT "fk_billing_periods_to_business_profiles"
          FOREIGN KEY ("business_id") REFERENCES "business_profiles" ("id") ON DELETE RESTRICT
      )
    `);

    // ─── tasks ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"          UUID          NOT NULL,
        "title"               VARCHAR(300)  NOT NULL,
        "description"         JSONB,
        "price"               NUMERIC(10,2) NOT NULL,
        "platform_fee_rate"   NUMERIC(5,4)  NOT NULL DEFAULT 0.1,
        "platform_fee_amount" NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(price * platform_fee_rate, 2)) STORED,
        "consultant_payout"   NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(price - (price * platform_fee_rate), 2)) STORED,
        "difficulty_level"    VARCHAR(20)   NOT NULL DEFAULT 'medium',
        "creation_mode"       VARCHAR(15)   NOT NULL DEFAULT 'manual',
        "kanban_status"       VARCHAR(25)   NOT NULL DEFAULT 'draft',
        "assigned_to"         UUID,
        "assigned_at"         TIMESTAMPTZ,
        "approved_by"         UUID,
        "approved_at"         TIMESTAMPTZ,
        "due_date"            TIMESTAMPTZ,
        "billing_period_id"   UUID,
        "display_order"       INTEGER       NOT NULL DEFAULT 0,
        "version"             INTEGER       NOT NULL DEFAULT 1,
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"          TIMESTAMPTZ,
        "created_by"          UUID,
        "updated_by"          UUID,
        "deleted_by"          UUID,
        CONSTRAINT "pk_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "fk_tasks_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_tasks_to_consultant_profiles"
          FOREIGN KEY ("assigned_to") REFERENCES "consultant_profiles" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_tasks_approved_by_to_users"
          FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_tasks_to_billing_periods"
          FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_project_status"  ON "tasks" ("project_id", "kanban_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_billing_period"  ON "tasks" ("billing_period_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_tasks_due_date"        ON "tasks" ("due_date")`);

    // ─── ai_session_messages ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_session_messages" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "session_id"    UUID          NOT NULL,
        "role"          VARCHAR(10)   NOT NULL,
        "content"       TEXT          NOT NULL,
        "linked_task_id" UUID,
        "token_count"   INTEGER,
        "message_order" INTEGER       NOT NULL,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"    UUID,
        CONSTRAINT "pk_ai_session_messages"                  PRIMARY KEY ("id"),
        CONSTRAINT "uq_ai_session_messages_session_order"    UNIQUE ("session_id", "message_order"),
        CONSTRAINT "fk_ai_session_messages_to_ai_task_sessions"
          FOREIGN KEY ("session_id") REFERENCES "ai_task_sessions" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_ai_session_messages_to_tasks"
          FOREIGN KEY ("linked_task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ai_messages_session_order" ON "ai_session_messages" ("session_id", "message_order")`,
    );

    // ─── task_history ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_history" (
        "id"                    UUID          NOT NULL DEFAULT gen_random_uuid(),
        "task_id"               UUID          NOT NULL,
        "previous_kanban_status" VARCHAR(25),
        "new_kanban_status"     VARCHAR(25),
        "previous_assigned_to"  UUID,
        "new_assigned_to"       UUID,
        "changed_by"            UUID,
        "change_type"           VARCHAR(30)   NOT NULL,
        "note"                  TEXT,
        "changed_at"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_task_history" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_history_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_history_prev_assignee_to_consultant_profiles"
          FOREIGN KEY ("previous_assigned_to") REFERENCES "consultant_profiles" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_task_history_new_assignee_to_consultant_profiles"
          FOREIGN KEY ("new_assigned_to") REFERENCES "consultant_profiles" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_task_history_changed_by_to_users"
          FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_history_task_id" ON "task_history" ("task_id", "changed_at")`,
    );

    // ─── task_comments ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_comments" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "task_id"    UUID        NOT NULL,
        "author_id"  UUID        NOT NULL,
        "comment"    JSONB       NOT NULL DEFAULT '{}',
        "is_edited"  BOOLEAN     NOT NULL DEFAULT FALSE,
        "edited_at"  TIMESTAMPTZ,
        "is_deleted" BOOLEAN     NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        "created_by" UUID,
        "updated_by" UUID,
        "deleted_by" UUID,
        CONSTRAINT "pk_task_comments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_comments_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_comments_to_users"
          FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_comments_task_id" ON "task_comments" ("task_id")`,
    );

    // ─── task_disputes ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_disputes" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "task_id"         UUID          NOT NULL,
        "opened_by"       UUID          NOT NULL,
        "reason"          TEXT          NOT NULL,
        "status"          VARCHAR(25)   NOT NULL DEFAULT 'open',
        "resolution_note" TEXT,
        "resolved_by"     UUID,
        "opened_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "resolved_at"     TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"      TIMESTAMPTZ,
        "created_by"      UUID,
        "updated_by"      UUID,
        "deleted_by"      UUID,
        CONSTRAINT "pk_task_disputes" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_disputes_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_task_disputes_opened_by_to_users"
          FOREIGN KEY ("opened_by") REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_task_disputes_resolved_by_to_users"
          FOREIGN KEY ("resolved_by") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_disputes_task_id" ON "task_disputes" ("task_id")`,
    );

    // ─── task_evidences ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_evidences" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "task_id"    UUID        NOT NULL,
        "author_id"  UUID        NOT NULL,
        "remarks"    JSONB       NOT NULL,
        "is_edited"  BOOLEAN     NOT NULL DEFAULT FALSE,
        "edited_at"  TIMESTAMPTZ,
        "is_deleted" BOOLEAN     NOT NULL DEFAULT FALSE,
        "version"    INTEGER     NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        "created_by" UUID,
        "updated_by" UUID,
        "deleted_by" UUID,
        CONSTRAINT "pk_task_evidences" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_evidences_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_evidences_to_users"
          FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_evidences_task_id"   ON "task_evidences" ("task_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_evidences_author_id" ON "task_evidences" ("author_id")`,
    );

    // ─── task_comment_attachments ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_comment_attachments" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "comment_id"      UUID          NOT NULL,
        "file_id"         UUID,
        "file_name"       VARCHAR(255)  NOT NULL,
        "file_url"        TEXT          NOT NULL,
        "file_size_bytes" BIGINT,
        "mime_type"       VARCHAR(100),
        "uploaded_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_task_comment_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_comment_attachments_to_task_comments"
          FOREIGN KEY ("comment_id") REFERENCES "task_comments" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_comment_attachments_to_files"
          FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE SET NULL
      )
    `);

    // ─── task_evidence_attachments ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_evidence_attachments" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "evidence_id"     UUID          NOT NULL,
        "file_id"         UUID,
        "file_name"       VARCHAR(255)  NOT NULL,
        "file_url"        TEXT          NOT NULL,
        "file_size_bytes" BIGINT,
        "mime_type"       VARCHAR(100),
        "uploaded_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_task_evidence_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_evidence_attachments_to_task_evidences"
          FOREIGN KEY ("evidence_id") REFERENCES "task_evidences" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_evidence_attachments_to_files"
          FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_evidence_attachments_evidence_id" ON "task_evidence_attachments" ("evidence_id")`,
    );

    // ─── invoices ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id"                          UUID          NOT NULL DEFAULT gen_random_uuid(),
        "billing_period_id"           UUID          NOT NULL,
        "business_id"                 UUID          NOT NULL,
        "amount"                      NUMERIC(12,2) NOT NULL,
        "task_total"                  NUMERIC(12,2) NOT NULL DEFAULT 0,
        "commission_rate"             NUMERIC(5,4)  NOT NULL DEFAULT 0.25,
        "commission_amount"           NUMERIC(12,2) NOT NULL DEFAULT 0,
        "currency"                    CHAR(3)       NOT NULL DEFAULT 'USD',
        "status"                      VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "processor_name"              VARCHAR(50),
        "processor_invoice_id"        VARCHAR(255),
        "processor_payment_intent_id" VARCHAR(255),
        "processor_payment_url"       TEXT,
        "due_date"                    DATE,
        "paid_at"                     TIMESTAMPTZ,
        "notified_at"                 TIMESTAMPTZ,
        "created_at"                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"                  TIMESTAMPTZ,
        "created_by"                  UUID,
        "updated_by"                  UUID,
        "deleted_by"                  UUID,
        CONSTRAINT "pk_invoices"                       PRIMARY KEY ("id"),
        CONSTRAINT "uq_invoices_billing_period_id"     UNIQUE ("billing_period_id"),
        CONSTRAINT "uq_invoices_processor_invoice_id"  UNIQUE ("processor_invoice_id"),
        CONSTRAINT "fk_invoices_to_billing_periods"
          FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_invoices_to_business_profiles"
          FOREIGN KEY ("business_id") REFERENCES "business_profiles" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_invoices_business_id" ON "invoices" ("business_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_invoices_status"      ON "invoices" ("status")`);

    // ─── invoice_line_items ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "invoice_line_items" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "invoice_id"          UUID          NOT NULL,
        "task_id"             UUID          NOT NULL,
        "consultant_id"       UUID          NOT NULL,
        "project_id"          UUID          NOT NULL,
        "description"         TEXT,
        "currency"            CHAR(3)       NOT NULL DEFAULT 'USD',
        "amount"              NUMERIC(10,2) NOT NULL,
        "platform_fee_amount" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "consultant_payout"   NUMERIC(10,2) NOT NULL,
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"          UUID,
        CONSTRAINT "pk_invoice_line_items"              PRIMARY KEY ("id"),
        CONSTRAINT "uq_invoice_line_items_invoice_task" UNIQUE ("invoice_id", "task_id"),
        CONSTRAINT "ck_invoice_line_items_amount_split"
          CHECK ("amount" = "platform_fee_amount" + "consultant_payout"),
        CONSTRAINT "fk_invoice_line_items_to_invoices"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_invoice_line_items_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_invoice_line_items_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_invoice_line_items_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_invoice"    ON "invoice_line_items" ("invoice_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_consultant" ON "invoice_line_items" ("consultant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_task"       ON "invoice_line_items" ("task_id")`,
    );

    // ─── business_transactions ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "business_transactions" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "business_id"         UUID          NOT NULL,
        "type"                VARCHAR(25)   NOT NULL,
        "amount"              NUMERIC(12,2) NOT NULL,
        "commission_rate"     NUMERIC(5,4),
        "commission_amount"   NUMERIC(12,2),
        "total_amount"        NUMERIC(12,2) NOT NULL,
        "status"              VARCHAR(20)   NOT NULL DEFAULT 'completed',
        "invoice_id"          UUID,
        "task_id"             UUID,
        "project_id"          UUID,
        "processor_event_id"  VARCHAR(255),
        "note"                TEXT,
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"          UUID,
        CONSTRAINT "pk_business_transactions"                       PRIMARY KEY ("id"),
        CONSTRAINT "uq_business_transactions_processor_event_id"    UNIQUE ("processor_event_id"),
        CONSTRAINT "fk_business_transactions_to_business_profiles"
          FOREIGN KEY ("business_id") REFERENCES "business_profiles" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_business_transactions_to_invoices"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_business_transactions_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_business_transactions_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_business_txn_business" ON "business_transactions" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_business_txn_project"  ON "business_transactions" ("project_id")`,
    );

    // ─── consultant_transactions ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_transactions" (
        "id"                   UUID          NOT NULL DEFAULT gen_random_uuid(),
        "consultant_id"        UUID          NOT NULL,
        "type"                 VARCHAR(20)   NOT NULL,
        "amount"               NUMERIC(12,2) NOT NULL,
        "commission_rate"      NUMERIC(5,4)  NOT NULL DEFAULT 0,
        "commission_amount"    NUMERIC(12,2) NOT NULL DEFAULT 0,
        "total_amount"         NUMERIC(12,2) NOT NULL DEFAULT 0,
        "status"               VARCHAR(20)   NOT NULL DEFAULT 'completed',
        "invoice_id"           UUID,
        "task_id"              UUID,
        "project_id"           UUID,
        "withdrawal_method"    VARCHAR(50),
        "withdrawal_reference" VARCHAR(255),
        "processor_event_id"   VARCHAR(255),
        "note"                 TEXT,
        "created_at"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"           UUID,
        CONSTRAINT "pk_consultant_transactions"                      PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_transactions_processor_event_id"   UNIQUE ("processor_event_id"),
        CONSTRAINT "fk_consultant_transactions_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_consultant_transactions_to_invoices"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_consultant_transactions_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_consultant_transactions_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_txn_consultant_created" ON "consultant_transactions" ("consultant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_txn_project"            ON "consultant_transactions" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_txn_task"               ON "consultant_transactions" ("task_id")`,
    );

    // ─── webhook_events ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
        "processor"    VARCHAR(50)   NOT NULL,
        "event_id"     VARCHAR(255)  NOT NULL,
        "event_type"   VARCHAR(100)  NOT NULL,
        "payload"      JSONB         NOT NULL,
        "status"       VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "retry_count"  SMALLINT      NOT NULL DEFAULT 0,
        "next_retry_at" TIMESTAMPTZ,
        "last_error"   TEXT,
        "processed_at" TIMESTAMPTZ,
        "received_at"  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_webhook_events"                      PRIMARY KEY ("id"),
        CONSTRAINT "uq_webhook_events_processor_event_id"   UNIQUE ("processor", "event_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_line_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_evidence_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_comment_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_evidences" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_disputes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_comments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_session_messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_periods" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_task_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interview_answers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_applications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_interview_questions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_required_skills" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skills" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "files" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_profiles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_profiles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sso_providers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "skills" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  }
}
