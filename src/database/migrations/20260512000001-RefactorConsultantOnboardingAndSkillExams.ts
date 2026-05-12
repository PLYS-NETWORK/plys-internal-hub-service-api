import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorConsultantOnboardingAndSkillExams20260512000001 implements MigrationInterface {
  public readonly name = 'RefactorConsultantOnboardingAndSkillExams20260512000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Drop obsolete consultant_applications family (greenfield) ────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_application_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_application_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_applications"`);

    // Keep `interview_questions` table. Drop any stale SKILL_BASED rows — those
    // are now AI-generated per-exam and stored in consultant_skill_exam_questions.
    await queryRunner.query(`DELETE FROM "interview_questions" WHERE "type" = 'SKILL_BASED'`);

    // ─── users: ban + strike columns ──────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "users"
         ADD COLUMN "ai_strike_count" SMALLINT NOT NULL DEFAULT 0,
         ADD COLUMN "banned_at" TIMESTAMPTZ,
         ADD COLUMN "ban_reason" VARCHAR(30)`,
    );

    // ─── consultant_profiles: cv_url, priority flag, avg_rating ───────────────
    await queryRunner.query(
      `ALTER TABLE "consultant_profiles"
         ADD COLUMN "cv_url" TEXT,
         ADD COLUMN "has_notification_priority" BOOLEAN NOT NULL DEFAULT FALSE,
         ADD COLUMN "avg_rating" NUMERIC(5,2)`,
    );

    // ─── consultant_skills: drop years_with_skill, add rating, relax proficiency_level
    await queryRunner.query(`ALTER TABLE "consultant_skills" DROP COLUMN "years_with_skill"`);
    await queryRunner.query(`ALTER TABLE "consultant_skills" ADD COLUMN "rating" NUMERIC(5,2)`);
    await queryRunner.query(
      `ALTER TABLE "consultant_skills"
         ALTER COLUMN "proficiency_level" DROP NOT NULL,
         ALTER COLUMN "proficiency_level" DROP DEFAULT`,
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

    // ─── consultant_onboarding_questions ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_onboarding_questions" (
        "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
        "onboarding_id"         UUID         NOT NULL,
        "interview_question_id" UUID         NOT NULL,
        "type"                  VARCHAR(20)  NOT NULL,
        "content_snapshot"      TEXT         NOT NULL,
        "question_order"        SMALLINT     NOT NULL,
        "created_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "created_by"            UUID,
        CONSTRAINT "pk_consultant_onboarding_questions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_onboarding_questions_order"
          UNIQUE ("onboarding_id", "question_order"),
        CONSTRAINT "fk_consultant_onboarding_questions_to_onboardings"
          FOREIGN KEY ("onboarding_id") REFERENCES "consultant_onboardings" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_consultant_onboarding_questions_to_interview_questions"
          FOREIGN KEY ("interview_question_id") REFERENCES "interview_questions" ("id") ON DELETE RESTRICT
      )
    `);

    // ─── consultant_onboarding_answers ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "consultant_onboarding_answers" (
        "id"                     UUID         NOT NULL DEFAULT gen_random_uuid(),
        "onboarding_question_id" UUID         NOT NULL,
        "answer_text"            TEXT         NOT NULL,
        "submitted_at"           TIMESTAMPTZ  NOT NULL,
        "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"             TIMESTAMPTZ,
        "created_by"             UUID,
        "updated_by"             UUID,
        "deleted_by"             UUID,
        CONSTRAINT "pk_consultant_onboarding_answers" PRIMARY KEY ("id"),
        CONSTRAINT "uq_consultant_onboarding_answers_question"
          UNIQUE ("onboarding_question_id"),
        CONSTRAINT "fk_consultant_onboarding_answers_to_questions"
          FOREIGN KEY ("onboarding_question_id")
          REFERENCES "consultant_onboarding_questions" ("id") ON DELETE CASCADE
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

    // ─── consultant_skill_scores (re-create with exam_id FK) ──────────────────
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
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_exam_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_exam_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_skill_exams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboarding_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboarding_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboardings"`);

    await queryRunner.query(`ALTER TABLE "consultant_skills" DROP COLUMN IF EXISTS "rating"`);
    await queryRunner.query(
      `ALTER TABLE "consultant_skills" ADD COLUMN IF NOT EXISTS "years_with_skill" SMALLINT`,
    );

    await queryRunner.query(
      `ALTER TABLE "consultant_profiles"
         DROP COLUMN IF EXISTS "cv_url",
         DROP COLUMN IF EXISTS "has_notification_priority",
         DROP COLUMN IF EXISTS "avg_rating"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users"
         DROP COLUMN IF EXISTS "ai_strike_count",
         DROP COLUMN IF EXISTS "banned_at",
         DROP COLUMN IF EXISTS "ban_reason"`,
    );
  }
}
