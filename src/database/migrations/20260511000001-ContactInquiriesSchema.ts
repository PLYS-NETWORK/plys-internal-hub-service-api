import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContactInquiriesSchema20260511000001 implements MigrationInterface {
  public readonly name = 'ContactInquiriesSchema20260511000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contact_inquiries" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "name"          VARCHAR(120)  NOT NULL,
        "email"         VARCHAR(254)  NOT NULL,
        "company"       VARCHAR(200)  NOT NULL,
        "topic"         VARCHAR(20)   NOT NULL,
        "message"       TEXT          NOT NULL,
        "status"        VARCHAR(20)   NOT NULL DEFAULT 'received',
        "email_status"  VARCHAR(30)   NOT NULL DEFAULT 'pending',
        "ip_address"    VARCHAR(45),
        "user_agent"    VARCHAR(512),
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_by"    UUID,
        CONSTRAINT "pk_contact_inquiries" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_contact_inquiries_created" ON "contact_inquiries" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_contact_inquiries_email_status" ON "contact_inquiries" ("email_status") WHERE "email_status" <> 'sent'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_inquiries_email_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_inquiries_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_inquiries"`);
  }
}
