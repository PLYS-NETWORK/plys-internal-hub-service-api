import { MigrationInterface, QueryRunner } from 'typeorm';

// Domain 4 — Tasks: introduces task_evidences (proof-of-work records authored
// by the assigned consultant) and task_evidence_attachments (denormalised file
// metadata per evidence). Also brings task_comment_attachments to parity by
// adding the same `file_id` FK column.
export class Domain4TaskEvidences1745568000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // task_evidences
    await queryRunner.query(`
      CREATE TABLE "task_evidences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "remarks" jsonb NOT NULL,
        "is_edited" boolean NOT NULL DEFAULT false,
        "edited_at" timestamptz,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "version" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_by" uuid,
        CONSTRAINT "pk_task_evidences" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_evidences_to_tasks"
          FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_evidences_to_users"
          FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_evidences_task_id" ON "task_evidences" ("task_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_evidences_author_id" ON "task_evidences" ("author_id");`,
    );

    // task_evidence_attachments
    await queryRunner.query(`
      CREATE TABLE "task_evidence_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "evidence_id" uuid NOT NULL,
        "file_id" uuid,
        "file_name" varchar(255) NOT NULL,
        "file_url" text NOT NULL,
        "file_size_bytes" bigint,
        "mime_type" varchar(100),
        "uploaded_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_task_evidence_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_task_evidence_attachments_to_task_evidences"
          FOREIGN KEY ("evidence_id") REFERENCES "task_evidences"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_evidence_attachments_to_files"
          FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_task_evidence_attachments_evidence_id" ON "task_evidence_attachments" ("evidence_id");`,
    );

    // Bring task_comment_attachments to parity — add file_id FK.
    await queryRunner.query(`ALTER TABLE "task_comment_attachments" ADD "file_id" uuid;`);
    await queryRunner.query(`
      ALTER TABLE "task_comment_attachments"
        ADD CONSTRAINT "fk_task_comment_attachments_to_files"
        FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_comment_attachments"
        DROP CONSTRAINT "fk_task_comment_attachments_to_files";
    `);
    await queryRunner.query(`ALTER TABLE "task_comment_attachments" DROP COLUMN "file_id";`);

    await queryRunner.query(`DROP INDEX "idx_task_evidence_attachments_evidence_id";`);
    await queryRunner.query(`DROP TABLE "task_evidence_attachments";`);

    await queryRunner.query(`DROP INDEX "idx_task_evidences_author_id";`);
    await queryRunner.query(`DROP INDEX "idx_task_evidences_task_id";`);
    await queryRunner.query(`DROP TABLE "task_evidences";`);
  }
}
