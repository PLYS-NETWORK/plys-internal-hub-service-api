import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminManagedOnboardingQuestions20260514000001 implements MigrationInterface {
  public readonly name = 'AdminManagedOnboardingQuestions20260514000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Drop legacy onboarding-answer + per-onboarding-question + interview-question schema ──
    // Order matters: drop child tables before parents.
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboarding_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboarding_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interview_questions"`);

    // ─── Drop the unused `availability` column from consultant_profiles ──
    await queryRunner.query(
      `ALTER TABLE "consultant_profiles" DROP COLUMN IF EXISTS "availability"`,
    );

    // ─── New admin-managed bank of onboarding questions ──
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

    // ─── Re-create consultant_onboarding_answers with new shape ──
    // Now: direct FK to onboarding + new onboarding_questions, frozen snapshot, jsonb answer.
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate legacy shape for rollback symmetry. Data is not restored.
    await queryRunner.query(`DROP TABLE IF EXISTS "consultant_onboarding_answers"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_onboarding_questions_active_position"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_questions"`);

    await queryRunner.query(
      `ALTER TABLE "consultant_profiles" ADD COLUMN IF NOT EXISTS "availability" VARCHAR(20)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interview_questions" (
        "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
        "type"          VARCHAR(20)  NOT NULL,
        "content"       TEXT         NOT NULL,
        "skill_id"      UUID,
        "is_active"     BOOLEAN      NOT NULL DEFAULT TRUE,
        "display_order" SMALLINT,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_by"    UUID,
        CONSTRAINT "pk_interview_questions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_interview_questions_to_skills"
          FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consultant_onboarding_questions" (
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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consultant_onboarding_answers" (
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
  }
}
