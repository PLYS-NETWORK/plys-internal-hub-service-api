import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaxIdToBusinessProfiles20260514000002 implements MigrationInterface {
  public readonly name = 'AddTaxIdToBusinessProfiles20260514000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // tax_id is required at the API layer but kept nullable in the DB so that
    // legacy business profiles (created before this column existed) remain
    // valid until the owner re-onboards or an admin backfills the value.
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "tax_id" VARCHAR(32) NULL`,
    );

    // The (tax_id, country_code) pair is not globally unique — uniqueness is
    // scoped to active users on the same platform and enforced in the
    // application layer (see BusinessProfileRepository.existsTaxIdConflict).
    // This index just keeps that scan cheap.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_business_profiles_tax_id_country"
         ON "business_profiles" ("tax_id", "country_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_profiles_tax_id_country"`);
    await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN IF EXISTS "tax_id"`);
  }
}
