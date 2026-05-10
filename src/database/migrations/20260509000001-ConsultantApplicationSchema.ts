import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsultantApplicationSchema20260509000001 implements MigrationInterface {
  public readonly name = 'ConsultantApplicationSchema20260509000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── interview_questions ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "interview_questions" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "type"          VARCHAR(20)   NOT NULL,
        "content"       TEXT          NOT NULL,
        "skill_id"      UUID,
        "is_active"     BOOLEAN       NOT NULL DEFAULT TRUE,
        "display_order" SMALLINT,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_by"    UUID,
        CONSTRAINT "pk_interview_questions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_interview_questions_to_skills"
          FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_interview_questions_type"     ON "interview_questions" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_interview_questions_skill_id" ON "interview_questions" ("skill_id")`,
    );

    // ─── consultant_applications ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_applications" (
        "id"                       UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"                  UUID          NOT NULL,
        "status"                   VARCHAR(30)   NOT NULL DEFAULT 'PENDING_PROFILE',
        "profile_submitted_at"     TIMESTAMPTZ,
        "interview_submitted_at"   TIMESTAMPTZ,
        "admin_triggered_by"       UUID,
        "admin_triggered_at"       TIMESTAMPTZ,
        "copyleaks_score"          NUMERIC(5,2),
        "copyleaks_checked_at"     TIMESTAMPTZ,
        "ai_eval_score"            NUMERIC(5,2),
        "ai_eval_completed_at"     TIMESTAMPTZ,
        "admin_eval_score"         NUMERIC(5,2),
        "admin_eval_completed_by"  UUID,
        "admin_eval_completed_at"  TIMESTAMPTZ,
        "final_score"              NUMERIC(5,2),
        "reviewed_by"              UUID,
        "reviewed_at"              TIMESTAMPTZ,
        "blocked_until"            TIMESTAMPTZ,
        "rejection_reason"         VARCHAR(30),
        "created_at"               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"               TIMESTAMPTZ,
        "created_by"               UUID,
        "updated_by"               UUID,
        "deleted_by"               UUID,
        CONSTRAINT "pk_consultant_applications" PRIMARY KEY ("id"),
        CONSTRAINT "fk_consultant_applications_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_applications_triggered_by_user"
          FOREIGN KEY ("admin_triggered_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_consultant_applications_admin_eval_by_user"
          FOREIGN KEY ("admin_eval_completed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_consultant_applications_reviewed_by_user"
          FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_applications_user_id"    ON "consultant_applications" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_applications_status"     ON "consultant_applications" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_applications_user_status" ON "consultant_applications" ("user_id", "status")`,
    );

    // ─── consultant_application_questions ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_application_questions" (
        "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
        "application_id"   UUID        NOT NULL,
        "question_id"      UUID        NOT NULL,
        "content_snapshot" TEXT        NOT NULL,
        "type"             VARCHAR(20) NOT NULL,
        "skill_id"         UUID,
        "question_order"   SMALLINT    NOT NULL,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_by"       UUID,
        CONSTRAINT "pk_consultant_application_questions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_application_questions_app_order"
          UNIQUE ("application_id", "question_order"),
        CONSTRAINT "fk_consultant_application_questions_to_applications"
          FOREIGN KEY ("application_id") REFERENCES "consultant_applications" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_application_questions_to_questions"
          FOREIGN KEY ("question_id") REFERENCES "interview_questions" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_consultant_application_questions_application_id"
        ON "consultant_application_questions" ("application_id")`,
    );

    // ─── consultant_application_answers ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_application_answers" (
        "id"                      UUID          NOT NULL DEFAULT gen_random_uuid(),
        "application_question_id" UUID          NOT NULL,
        "answer_text"             TEXT          NOT NULL,
        "submitted_at"            TIMESTAMPTZ   NOT NULL,
        "copyleaks_ai_score"      NUMERIC(5,2),
        "ai_eval_score"           NUMERIC(5,2),
        "ai_feedback"             TEXT,
        "admin_score"             NUMERIC(5,2),
        "admin_notes"             TEXT,
        "created_at"              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"              TIMESTAMPTZ,
        "created_by"              UUID,
        "updated_by"              UUID,
        "deleted_by"              UUID,
        CONSTRAINT "pk_consultant_application_answers" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_application_answers_question"
          UNIQUE ("application_question_id"),
        CONSTRAINT "fk_consultant_application_answers_to_questions"
          FOREIGN KEY ("application_question_id")
          REFERENCES "consultant_application_questions" ("id") ON DELETE CASCADE
      )
    `);

    // ─── consultant_skill_scores ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_skill_scores" (
        "consultant_id"  UUID        NOT NULL,
        "skill_id"       UUID        NOT NULL,
        "application_id" UUID        NOT NULL,
        "score"          NUMERIC(5,2) NOT NULL,
        "calculated_at"  TIMESTAMPTZ NOT NULL,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_by"     UUID,
        CONSTRAINT "pk_consultant_skill_scores" PRIMARY KEY ("consultant_id", "skill_id"),
        CONSTRAINT "fk_consultant_skill_scores_to_consultant_profiles"
          FOREIGN KEY ("consultant_id") REFERENCES "consultant_profiles" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_skill_scores_to_skills"
          FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_skill_scores_to_applications"
          FOREIGN KEY ("application_id") REFERENCES "consultant_applications" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_application_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_application_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interview_questions"`);
  }
}
