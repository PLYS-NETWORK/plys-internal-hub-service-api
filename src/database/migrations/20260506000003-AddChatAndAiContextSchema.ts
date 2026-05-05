import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Step C-1 schema foundation for the project AI chat:
 *   - project_chat_session   — multi-session chat header (mode/stage/status/draft)
 *   - chat_message           — append-only message log (one row per message,
 *                              paginated by `seq` per session)
 *   - project_ai_context     — persistent per-project AI memory; FE writes
 *                              derived fields, BE maintains task_index
 *   - idempotency_key        — request replay cache for orchestration endpoints
 *   - ai_provider_api_key    — admin-managed model API keys, encrypted at rest
 *
 * No data is seeded; the chat surface activates as code in subsequent steps
 * starts referencing these tables.
 */
export class AddChatAndAiContextSchema20260506000003 implements MigrationInterface {
  public readonly name = 'AddChatAndAiContextSchema20260506000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── project_chat_session ────────────────────────────────────────────────
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
    // Active-session lookup (FE picker shows only active rows).
    await queryRunner.query(`
      CREATE INDEX "idx_project_chat_session_active"
        ON "project_chat_session" ("project_id", "user_id")
        WHERE "status" = 'active'
    `);

    // ─── chat_message ────────────────────────────────────────────────────────
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
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_chat_message_session_seq"
        ON "chat_message" ("session_id", "seq")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_chat_message_session_seq_desc"
        ON "chat_message" ("session_id", "seq" DESC)
    `);

    // ─── project_ai_context ──────────────────────────────────────────────────
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
    // Cron sweep that flips stale rows runs against this partial index.
    await queryRunner.query(`
      CREATE INDEX "idx_project_ai_context_needs_reindex"
        ON "project_ai_context" ("needs_reindex")
        WHERE "needs_reindex" = TRUE
    `);

    // ─── idempotency_key ─────────────────────────────────────────────────────
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
    await queryRunner.query(`
      CREATE INDEX "idx_idempotency_key_expires_at"
        ON "idempotency_key" ("expires_at")
    `);

    // ─── ai_provider_api_key ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_provider_api_key" (
        "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
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
    await queryRunner.query(`
      CREATE INDEX "idx_ai_provider_api_key_provider"
        ON "ai_provider_api_key" ("provider")
    `);
    // At most one active key per provider.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_ai_provider_api_key_active_per_provider"
        ON "ai_provider_api_key" ("provider")
        WHERE "is_active" = TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse FK order so dependent constraints unwind cleanly.
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_provider_api_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_ai_context"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_chat_session"`);
  }
}
