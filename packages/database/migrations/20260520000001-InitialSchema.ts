import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema20260520000001 implements MigrationInterface {
  public readonly name = 'InitialSchema20260520000001';

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
        "ai_strike_count"   SMALLINT      NOT NULL DEFAULT 0,
        "banned_at"         TIMESTAMPTZ,
        "ban_reason"        VARCHAR(30),
        "exam_expired_count"        SMALLINT     NOT NULL DEFAULT 0,
        "exam_taking_blocked_until" TIMESTAMPTZ,
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
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_skills_name_lower" ON "skills" (LOWER("name"))`,
    );

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
      `CREATE INDEX "idx_auth_tokens_user_id"      ON "auth_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_tokens_type_expires"  ON "auth_tokens" ("type", "expires_at")`,
    );

    // ─── user_sessions ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"       UUID          NOT NULL,
        "session_token" TEXT          NOT NULL,
        "device_id"     VARCHAR(255),
        "fingerprint"   TEXT,
        "ip_address"    INET,
        "user_agent"    TEXT,
        "timezone"      VARCHAR(64),
        "expires_at"    TIMESTAMPTZ   NOT NULL,
        "used_at"       TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_by"    UUID,
        CONSTRAINT "pk_user_sessions"               PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_sessions_session_token"  UNIQUE ("session_token"),
        CONSTRAINT "fk_user_sessions_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_user_id"       ON "user_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_expires_at"     ON "user_sessions" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_device_id"      ON "user_sessions" ("device_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_token_used_at"  ON "user_sessions" ("session_token", "used_at")`,
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
        CONSTRAINT "pk_user_sso_providers"                              PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_sso_providers_platform_provider_identity"   UNIQUE ("platform", "provider", "provider_user_id"),
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
        "avatar_url"                TEXT,
        "cv_url"                    TEXT,
        "address_line"              VARCHAR(255),
        "city"                      VARCHAR(100),
        "state_province"            VARCHAR(100),
        "postal_code"               VARCHAR(20),
        "country_code"              CHAR(2),
        "phone_number"              VARCHAR(30),
        "is_verified"               BOOLEAN       NOT NULL DEFAULT FALSE,
        "has_notification_priority" BOOLEAN       NOT NULL DEFAULT FALSE,
        "avg_rating"                NUMERIC(5,2),
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
        "owner_name"                VARCHAR(255),
        "tax_id"                    VARCHAR(32),
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
    // The (tax_id, country_code) pair is not globally unique — uniqueness is
    // scoped to active users on the same platform and enforced in the
    // application layer (see BusinessProfileRepository.existsTaxIdConflict).
    // This index just keeps that scan cheap.
    await queryRunner.query(
      `CREATE INDEX "idx_business_profiles_tax_id_country"
         ON "business_profiles" ("tax_id", "country_code")`,
    );

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
    await queryRunner.query(`CREATE INDEX "idx_files_purpose"    ON "files" ("purpose")`);
    await queryRunner.query(`CREATE INDEX "idx_files_deleted_at" ON "files" ("deleted_at")`);

    // ─── consultant_skills ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_skills" (
        "consultant_id"     UUID          NOT NULL,
        "skill_id"          UUID          NOT NULL,
        "proficiency_level" VARCHAR(20),
        "rating"            NUMERIC(5,2),
        "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"        UUID,
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
        "code"                 VARCHAR(8)    NOT NULL,
        "status"               VARCHAR(20)   NOT NULL DEFAULT 'draft',
        "payment_type"         VARCHAR(20)   NOT NULL DEFAULT 'per_task',
        "required_consultants" SMALLINT      NOT NULL DEFAULT 0,
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
        CONSTRAINT "pk_projects"                    PRIMARY KEY ("id"),
        CONSTRAINT "ck_projects_payment_type"        CHECK ("payment_type" IN ('per_task', 'per_month')),
        CONSTRAINT "fk_projects_to_business_profiles"
          FOREIGN KEY ("business_id") REFERENCES "business_profiles" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_projects_business_code"        ON "projects" ("business_id", "code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_projects_business_id"                ON "projects" ("business_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_projects_status"          ON "projects" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_projects_status_published_at"        ON "projects" ("status", "published_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_projects_payment_type"               ON "projects" ("payment_type")`,
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

    // ─── project_members ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"    UUID          NOT NULL,
        "consultant_id" UUID          NOT NULL,
        "status"        VARCHAR(20)   NOT NULL DEFAULT 'active',
        "joined_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "left_at"       TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_by"    UUID,
        CONSTRAINT "pk_project_members"                    PRIMARY KEY ("id"),
        CONSTRAINT "uq_project_members_project_consultant" UNIQUE ("project_id", "consultant_id"),
        CONSTRAINT "fk_project_members_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_members_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_project_members_project_id"    ON "project_members" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_project_members_consultant_id" ON "project_members" ("consultant_id")`,
    );

    // ─── project_status_history ───────────────────────────────────────────────
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
    // Trigger function — auto-logs every projects.status change via the AuditableEntity
    // updated_by field so every code path is covered without manual calls.
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
        CONSTRAINT "pk_billing_periods"                       PRIMARY KEY ("id"),
        CONSTRAINT "uq_billing_periods_business_period_start" UNIQUE ("business_id", "period_start"),
        CONSTRAINT "ck_billing_periods_period_dates_valid"     CHECK ("period_end" >= "period_start"),
        CONSTRAINT "fk_billing_periods_to_business_profiles"
          FOREIGN KEY ("business_id") REFERENCES "business_profiles" ("id") ON DELETE RESTRICT
      )
    `);

    // ─── tasks ────────────────────────────────────────────────────────────────
    // `revision_count` caps REVISION_REQUESTED bounce-backs at 3; the next
    // failure escalates to a TaskDispute. `last_review_round` scopes
    // `task_reviews` rows so the same reviewer can be assigned again on a
    // later round without violating the (task, reviewer, round) unique key.
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"          UUID          NOT NULL,
        "code"                VARCHAR(20)   NOT NULL,
        "code_seq"            INT           NOT NULL,
        "title"               VARCHAR(300)  NOT NULL,
        "description"         JSONB,
        "price"               NUMERIC(10,2) NOT NULL,
        "platform_fee_rate"   NUMERIC(5,4)  NOT NULL DEFAULT 0.1,
        "platform_fee_amount" NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(price * platform_fee_rate, 2)) STORED,
        "consultant_payout"   NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(price - (price * platform_fee_rate), 2)) STORED,
        "creation_mode"       VARCHAR(15)   NOT NULL DEFAULT 'manual',
        "kanban_status"       VARCHAR(25)   NOT NULL DEFAULT 'draft',
        "assigned_to"         UUID,
        "assigned_at"         TIMESTAMPTZ,
        "approved_by"         UUID,
        "approved_at"         TIMESTAMPTZ,
        "due_date"            TIMESTAMPTZ,
        "started_at"          TIMESTAMPTZ,
        "completed_at"        TIMESTAMPTZ,
        "billing_period_id"   UUID,
        "display_order"       INTEGER       NOT NULL DEFAULT 0,
        "revision_count"      INT           NOT NULL DEFAULT 0,
        "last_review_round"   INT           NOT NULL DEFAULT 0,
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
      `CREATE UNIQUE INDEX "uq_tasks_project_code_seq" ON "tasks" ("project_id", "code_seq")`,
    );
    // Partial unique index — enforces per-column ordering for live tasks only.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tasks_project_status_order" ON "tasks" ("project_id", "kanban_status", "display_order") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(`CREATE INDEX "idx_tasks_code"          ON "tasks" ("code")`);
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_project_status_order" ON "tasks" ("project_id", "kanban_status", "display_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_billing_period" ON "tasks" ("billing_period_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_tasks_due_date"        ON "tasks" ("due_date")`);
    await queryRunner.query(`CREATE INDEX "idx_tasks_started_at"      ON "tasks" ("started_at")`);
    await queryRunner.query(`CREATE INDEX "idx_tasks_completed_at"    ON "tasks" ("completed_at")`);

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

    // ─── ai_session_messages ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_session_messages" (
        "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
        "session_id"     UUID          NOT NULL,
        "role"           VARCHAR(10)   NOT NULL,
        "content"        TEXT          NOT NULL,
        "linked_task_id" UUID,
        "token_count"    INTEGER,
        "message_order"  INTEGER       NOT NULL,
        "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"     UUID,
        CONSTRAINT "pk_ai_session_messages"               PRIMARY KEY ("id"),
        CONSTRAINT "uq_ai_session_messages_session_order" UNIQUE ("session_id", "message_order"),
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
        "id"                     UUID          NOT NULL DEFAULT gen_random_uuid(),
        "task_id"                UUID          NOT NULL,
        "previous_kanban_status" VARCHAR(25),
        "new_kanban_status"      VARCHAR(25),
        "previous_assigned_to"   UUID,
        "new_assigned_to"        UUID,
        "changed_by"             UUID,
        "change_type"            VARCHAR(30)   NOT NULL,
        "note"                   TEXT,
        "changed_at"             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
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

    // ─── task_results ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_results" (
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
        CONSTRAINT "pk_task_results" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_results_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_results_to_users"
          FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_results_task_id"   ON "task_results" ("task_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_results_author_id" ON "task_results" ("author_id")`,
    );

    // ─── task_result_attachments ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_result_attachments" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "result_id"       UUID          NOT NULL,
        "file_id"         UUID,
        "file_name"       VARCHAR(255)  NOT NULL,
        "file_url"        TEXT          NOT NULL,
        "file_size_bytes" BIGINT,
        "mime_type"       VARCHAR(100),
        "uploaded_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_task_result_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_result_attachments_to_task_results"
          FOREIGN KEY ("result_id") REFERENCES "task_results" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_result_attachments_to_files"
          FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_result_attachments_result_id" ON "task_result_attachments" ("result_id")`,
    );

    // ─── task_attachments ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_attachments" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "task_id"         UUID          NOT NULL,
        "file_id"         UUID,
        "file_name"       VARCHAR(255)  NOT NULL,
        "file_url"        TEXT          NOT NULL,
        "file_size_bytes" BIGINT,
        "mime_type"       VARCHAR(100),
        "uploaded_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"      TIMESTAMPTZ,
        "created_by"      UUID,
        "updated_by"      UUID,
        "deleted_by"      UUID,
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

    // ─── task_reviews ─────────────────────────────────────────────────────────
    // One row per reviewer per round. `is_arbiter` flags the 3rd reviewer
    // assigned to break a 1-1 split; their vote does NOT flip the outcome —
    // any 1-1 split resolves to REVISION_REQUESTED regardless.
    await queryRunner.query(`
      CREATE TABLE "task_reviews" (
        "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
        "task_id"       UUID         NOT NULL,
        "reviewer_id"   UUID         NOT NULL,
        "round_number"  INT          NOT NULL,
        "decision"      VARCHAR(15)  NOT NULL DEFAULT 'pending',
        "is_arbiter"    BOOLEAN      NOT NULL DEFAULT FALSE,
        "feedback"      TEXT,
        "assigned_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "voted_at"      TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_by"    UUID,
        CONSTRAINT "pk_task_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "uq_task_reviews_task_reviewer_round"
          UNIQUE ("task_id", "reviewer_id", "round_number"),
        CONSTRAINT "fk_task_reviews_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_reviews_to_users"
          FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_reviews_task_round_decision" ON "task_reviews" ("task_id", "round_number", "decision")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_reviews_reviewer_decision" ON "task_reviews" ("reviewer_id", "decision")`,
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
        CONSTRAINT "pk_invoices"                      PRIMARY KEY ("id"),
        CONSTRAINT "uq_invoices_billing_period_id"    UNIQUE ("billing_period_id"),
        CONSTRAINT "uq_invoices_processor_invoice_id" UNIQUE ("processor_invoice_id"),
        CONSTRAINT "fk_invoices_to_billing_periods"
          FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_invoices_to_business_profiles"
          FOREIGN KEY ("business_id") REFERENCES "business_profiles" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_invoices_business_id" ON "invoices" ("business_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_invoices_status" ON "invoices" ("status")`);

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
        "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
        "business_id"        UUID          NOT NULL,
        "transaction_number" VARCHAR(32)   NOT NULL,
        "type"               VARCHAR(25)   NOT NULL,
        "amount"             NUMERIC(12,2) NOT NULL,
        "commission_rate"    NUMERIC(5,4),
        "commission_amount"  NUMERIC(12,2),
        "total_amount"       NUMERIC(12,2) NOT NULL,
        "status"             VARCHAR(20)   NOT NULL DEFAULT 'completed',
        "invoice_id"         UUID,
        "task_id"            UUID,
        "project_id"         UUID,
        "processor_event_id" VARCHAR(255),
        "note"               TEXT,
        "payer_info"         JSONB,
        "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"         UUID,
        CONSTRAINT "pk_business_transactions"                    PRIMARY KEY ("id"),
        CONSTRAINT "uq_business_transactions_number"             UNIQUE ("transaction_number"),
        CONSTRAINT "uq_business_transactions_processor_event_id" UNIQUE ("processor_event_id"),
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
        "transaction_number"   VARCHAR(32)   NOT NULL,
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
        CONSTRAINT "pk_consultant_transactions"                     PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_transactions_number"              UNIQUE ("transaction_number"),
        CONSTRAINT "uq_consultant_transactions_processor_event_id"  UNIQUE ("processor_event_id"),
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
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "processor"     VARCHAR(50)   NOT NULL,
        "event_id"      VARCHAR(255)  NOT NULL,
        "event_type"    VARCHAR(100)  NOT NULL,
        "payload"       JSONB         NOT NULL,
        "status"        VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "retry_count"   SMALLINT      NOT NULL DEFAULT 0,
        "next_retry_at" TIMESTAMPTZ,
        "last_error"    TEXT,
        "processed_at"  TIMESTAMPTZ,
        "received_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_webhook_events"                    PRIMARY KEY ("id"),
        CONSTRAINT "uq_webhook_events_processor_event_id" UNIQUE ("processor", "event_id")
      )
    `);

    // ─── notifications ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"      UUID          NOT NULL,
        "type"         VARCHAR(40)   NOT NULL,
        "title"        VARCHAR(200)  NOT NULL,
        "body"         VARCHAR(500)  NOT NULL,
        "metadata"     JSONB         NOT NULL,
        "entity_type"  VARCHAR(30)   NOT NULL,
        "entity_id"    VARCHAR(64)   NOT NULL,
        "redirect_url" VARCHAR(1024),
        "actor_id"     UUID,
        "is_read"      BOOLEAN       NOT NULL DEFAULT FALSE,
        "read_at"      TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"   UUID,
        CONSTRAINT "pk_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "fk_notifications_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_notifications_actor_to_users"
          FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC)`,
    );
    // Partial index — only unread rows; keeps it tiny and hot.
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_unread" ON "notifications" ("user_id") WHERE "is_read" = FALSE`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_entity" ON "notifications" ("entity_type", "entity_id")`,
    );

    // ─── project_chat_session ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_chat_session" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"       UUID          NOT NULL,
        "user_id"          UUID          NOT NULL,
        "mode"             VARCHAR(15)   NOT NULL,
        "stage"            VARCHAR(30),
        "title"            VARCHAR(160)  NOT NULL,
        "status"           VARCHAR(15)   NOT NULL DEFAULT 'active',
        "draft"            JSONB         NOT NULL DEFAULT '{}'::jsonb,
        "message_count"    INT           NOT NULL DEFAULT 0,
        "implemented_at"   TIMESTAMPTZ,
        "created_task_ids" JSONB,
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        "created_by"       UUID,
        "updated_by"       UUID,
        "deleted_by"       UUID,
        CONSTRAINT "pk_project_chat_session" PRIMARY KEY ("id"),
        CONSTRAINT "fk_project_chat_session_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_project_chat_session_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_project_chat_session_project_user_updated"
        ON "project_chat_session" ("project_id", "user_id", "updated_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_project_chat_session_active"
        ON "project_chat_session" ("project_id", "user_id")
        WHERE "status" = 'active'
    `);

    // ─── chat_message ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "chat_message" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "session_id" UUID          NOT NULL,
        "seq"        INT           NOT NULL,
        "role"       VARCHAR(20)   NOT NULL,
        "parts"      JSONB         NOT NULL,
        "metadata"   JSONB,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_chat_message" PRIMARY KEY ("id"),
        CONSTRAINT "fk_chat_message_to_project_chat_session"
          FOREIGN KEY ("session_id") REFERENCES "project_chat_session" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_chat_message_session_seq"     ON "chat_message" ("session_id", "seq")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_message_session_seq_desc" ON "chat_message" ("session_id", "seq" DESC)`,
    );

    // ─── project_ai_context ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_ai_context" (
        "project_id"          UUID          NOT NULL,
        "domain"              VARCHAR(200),
        "primary_stack"       JSONB,
        "conventions"         TEXT,
        "planning_summary"    TEXT,
        "refine_summary"      TEXT,
        "extend_summary"      TEXT,
        "task_index"          JSONB         NOT NULL DEFAULT '[]'::jsonb,
        "skill_clusters"      JSONB         NOT NULL DEFAULT '{}'::jsonb,
        "decisions"           JSONB         NOT NULL DEFAULT '[]'::jsonb,
        "last_indexed_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "task_count_at_index" INT           NOT NULL DEFAULT 0,
        "needs_reindex"       BOOLEAN       NOT NULL DEFAULT FALSE,
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_project_ai_context" PRIMARY KEY ("project_id"),
        CONSTRAINT "fk_project_ai_context_to_projects"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
      )
    `);
    // Partial index used by the cron sweep that flips stale rows.
    await queryRunner.query(`
      CREATE INDEX "idx_project_ai_context_needs_reindex"
        ON "project_ai_context" ("needs_reindex")
        WHERE "needs_reindex" = TRUE
    `);

    // ─── idempotency_key ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "idempotency_key" (
        "key"             VARCHAR(80)   NOT NULL,
        "user_id"         UUID          NOT NULL,
        "endpoint"        VARCHAR(120)  NOT NULL,
        "request_hash"    CHAR(64)      NOT NULL,
        "response_status" SMALLINT      NOT NULL,
        "response_body"   JSONB         NOT NULL,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "expires_at"      TIMESTAMPTZ   NOT NULL,
        CONSTRAINT "pk_idempotency_key" PRIMARY KEY ("key", "user_id", "endpoint"),
        CONSTRAINT "fk_idempotency_key_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_idempotency_key_expires_at" ON "idempotency_key" ("expires_at")`,
    );

    // ─── ai_provider_api_key ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_provider_api_key" (
        "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
        "assistant_type"     VARCHAR(20)   NOT NULL,
        "provider"           VARCHAR(20)   NOT NULL,
        "model"              VARCHAR(80)   NOT NULL,
        "label"              VARCHAR(80)   NOT NULL,
        "master_key_version" SMALLINT      NOT NULL,
        "key_ciphertext"     TEXT          NOT NULL,
        "key_last4"          CHAR(4)       NOT NULL,
        "is_active"          BOOLEAN       NOT NULL DEFAULT FALSE,
        "created_by"         UUID          NOT NULL,
        "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_ai_provider_api_key" PRIMARY KEY ("id"),
        CONSTRAINT "fk_ai_provider_api_key_to_users"
          FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ai_provider_api_key_provider" ON "ai_provider_api_key" ("provider")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ai_provider_api_key_assistant_type" ON "ai_provider_api_key" ("assistant_type")`,
    );
    // At most one active key per assistant_type. The active-key partition
    // moved off `provider` so admins can run e.g. a Groq chat-box key and a
    // Groq interview key concurrently — provider is now informational only.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_ai_provider_api_key_active_per_assistant_type"
        ON "ai_provider_api_key" ("assistant_type")
        WHERE "is_active" = TRUE
    `);

    // ─── admin_allowed_emails ─────────────────────────────────────────────────
    // `role` tags the row with the UserRole to provision at first OTP login.
    // Restricted in the application layer to invitable roles (ADMIN_PLATFORM
    // or TASK_REVIEWER); the column stores either value as VARCHAR(20).
    await queryRunner.query(`
      CREATE TABLE "admin_allowed_emails" (
        "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
        "email"      VARCHAR(255) NOT NULL,
        "is_active"  BOOLEAN      NOT NULL DEFAULT TRUE,
        "role"       VARCHAR(20)  NOT NULL DEFAULT 'ADMIN_PLATFORM',
        "created_by" UUID,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_admin_allowed_emails"       PRIMARY KEY ("id"),
        CONSTRAINT "uq_admin_allowed_emails_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_admin_allowed_emails_email" ON "admin_allowed_emails" ("email")`,
    );

    // ─── consultant_onboardings ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_onboardings" (
        "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"                UUID         NOT NULL,
        "status"                 VARCHAR(30)  NOT NULL DEFAULT 'PENDING_BASIC_INFO',
        "profile_submitted_at"   TIMESTAMPTZ,
        "interview_submitted_at" TIMESTAMPTZ,
        "reviewed_by"            UUID,
        "reviewed_at"            TIMESTAMPTZ,
        "decision"               VARCHAR(20),
        "rejection_note"         TEXT,
        "blocked_until"          TIMESTAMPTZ,
        "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"             TIMESTAMPTZ,
        "created_by"             UUID,
        "updated_by"             UUID,
        "deleted_by"             UUID,
        CONSTRAINT "pk_consultant_onboardings" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_onboardings_user_id" UNIQUE ("user_id"),
        CONSTRAINT "fk_consultant_onboardings_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_onboardings_reviewed_by_user"
          FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_onboardings_status"      ON "consultant_onboardings" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_onboardings_user_status" ON "consultant_onboardings" ("user_id", "status")`,
    );

    // ─── onboarding_questions ─────────────────────────────────────────────────
    // Admin-managed bank of onboarding questions referenced by consultant_onboarding_answers.
    await queryRunner.query(`
      CREATE TABLE "onboarding_questions" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "type"         VARCHAR(16)  NOT NULL,
        "question"     TEXT         NOT NULL,
        "options"      JSONB,
        "position"     SMALLINT,
        "is_active"    BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        "created_by"   UUID,
        "updated_by"   UUID,
        "deleted_by"   UUID,
        CONSTRAINT "pk_onboarding_questions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_onboarding_questions_is_active" ON "onboarding_questions" ("is_active")`,
    );
    // Partial unique index — guarantees positions 1..N are unique among the live active set
    // while letting inactive / soft-deleted rows hold position=NULL freely.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_onboarding_questions_active_position"
         ON "onboarding_questions" ("position")
         WHERE "is_active" = TRUE AND "deleted_at" IS NULL`,
    );

    // ─── consultant_onboarding_answers ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_onboarding_answers" (
        "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
        "onboarding_id"          UUID         NOT NULL,
        "onboarding_question_id" UUID         NOT NULL,
        "question_snapshot"      JSONB        NOT NULL,
        "answer_value"           JSONB        NOT NULL,
        "submitted_at"           TIMESTAMPTZ  NOT NULL,
        "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"             TIMESTAMPTZ,
        "created_by"             UUID,
        "updated_by"             UUID,
        "deleted_by"             UUID,
        CONSTRAINT "pk_consultant_onboarding_answers" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_onboarding_answers_onboarding_question"
          UNIQUE ("onboarding_id", "onboarding_question_id"),
        CONSTRAINT "fk_consultant_onboarding_answers_to_onboardings"
          FOREIGN KEY ("onboarding_id")
          REFERENCES "consultant_onboardings" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_onboarding_answers_to_questions"
          FOREIGN KEY ("onboarding_question_id")
          REFERENCES "onboarding_questions" ("id") ON DELETE RESTRICT
      )
    `);

    // ─── consultant_skill_exams ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_skill_exams" (
        "id"                        UUID         NOT NULL DEFAULT gen_random_uuid(),
        "consultant_id"             UUID         NOT NULL,
        "skill_id"                  UUID         NOT NULL,
        "status"                    VARCHAR(30)  NOT NULL DEFAULT 'GENERATING_QUESTIONS',
        "attempt_number"            SMALLINT     NOT NULL DEFAULT 1,
        "started_at"                TIMESTAMPTZ,
        "expires_at"                TIMESTAMPTZ,
        "submitted_at"              TIMESTAMPTZ,
        "copyleaks_checked_at"      TIMESTAMPTZ,
        "ai_eval_completed_at"      TIMESTAMPTZ,
        "concluded_at"              TIMESTAMPTZ,
        "copyleaks_aggregate_score" NUMERIC(5,2),
        "ai_eval_score"             NUMERIC(5,2),
        "correct_count"             SMALLINT,
        "assigned_proficiency"      VARCHAR(20),
        "cooldown_until"            TIMESTAMPTZ,
        "fail_reason"               VARCHAR(30),
        "created_at"                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"                TIMESTAMPTZ,
        "created_by"                UUID,
        "updated_by"                UUID,
        "deleted_by"                UUID,
        CONSTRAINT "pk_consultant_skill_exams" PRIMARY KEY ("id"),
        CONSTRAINT "fk_consultant_skill_exams_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_skill_exams_to_skills"
          FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_skill_exams_consultant_status"
         ON "consultant_skill_exams" ("consultant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_skill_exams_consultant_skill"
         ON "consultant_skill_exams" ("consultant_id", "skill_id")`,
    );

    // ─── consultant_skill_exam_questions ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_skill_exam_questions" (
        "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
        "exam_id"               UUID         NOT NULL,
        "question_order"        SMALLINT     NOT NULL,
        "content"               TEXT         NOT NULL,
        "expected_answer_hints" JSONB,
        "created_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "created_by"            UUID,
        CONSTRAINT "pk_consultant_skill_exam_questions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_skill_exam_questions_order"
          UNIQUE ("exam_id", "question_order"),
        CONSTRAINT "fk_consultant_skill_exam_questions_to_exams"
          FOREIGN KEY ("exam_id") REFERENCES "consultant_skill_exams" ("id") ON DELETE CASCADE
      )
    `);

    // ─── consultant_skill_exam_answers ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_skill_exam_answers" (
        "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
        "exam_question_id"    UUID         NOT NULL,
        "answer_text"         TEXT         NOT NULL,
        "submitted_at"        TIMESTAMPTZ  NOT NULL,
        "copyleaks_ai_score"  NUMERIC(5,2),
        "ai_eval_score"       NUMERIC(5,2),
        "is_correct"          BOOLEAN,
        "ai_feedback"         TEXT,
        "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"          TIMESTAMPTZ,
        "created_by"          UUID,
        "updated_by"          UUID,
        "deleted_by"          UUID,
        CONSTRAINT "pk_consultant_skill_exam_answers" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_skill_exam_answers_question"
          UNIQUE ("exam_question_id"),
        CONSTRAINT "fk_consultant_skill_exam_answers_to_questions"
          FOREIGN KEY ("exam_question_id")
          REFERENCES "consultant_skill_exam_questions" ("id") ON DELETE CASCADE
      )
    `);

    // ─── consultant_skill_scores ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_skill_scores" (
        "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
        "consultant_id" UUID         NOT NULL,
        "skill_id"      UUID         NOT NULL,
        "exam_id"       UUID         NOT NULL,
        "score"         NUMERIC(5,2) NOT NULL,
        "calculated_at" TIMESTAMPTZ  NOT NULL,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "created_by"    UUID,
        CONSTRAINT "pk_consultant_skill_scores" PRIMARY KEY ("id"),
        CONSTRAINT "fk_consultant_skill_scores_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_skill_scores_to_skills"
          FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_skill_scores_to_skill_exams"
          FOREIGN KEY ("exam_id") REFERENCES "consultant_skill_exams" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_skill_scores_consultant_skill"
         ON "consultant_skill_scores" ("consultant_id", "skill_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_scores" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_exam_answers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_exam_questions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_exams" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboarding_answers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_questions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboardings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_allowed_emails" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_provider_api_key" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_key" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_ai_context" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_chat_session" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_line_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_reviews" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_result_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_results" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_disputes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_session_messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_task_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_periods" CASCADE`);
    await queryRunner.query(`DROP TRIGGER  IF EXISTS trg_log_project_status_change ON projects`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS trg_log_project_status_change()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_status_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_members" CASCADE`);
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
