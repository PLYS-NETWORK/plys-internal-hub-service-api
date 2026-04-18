import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Domain 2 — Profiles
// Creates: business_profiles, business_members, skills, consultant_profiles, consultant_skills
// Applies schema fixes:
//   §M1        skills.name case-insensitive via LOWER(name) functional unique index
//   §low-nit   business_members.role default changed from 'member' → 'viewer'
export class Domain2Profiles1713398500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
          {
            name: 'role',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'viewer'`,
          },
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
      new TableIndex({
        name: 'idx_business_members_business_id',
        columnNames: ['business_id'],
      }),
    );

    await queryRunner.createIndex(
      'business_members',
      new TableIndex({
        name: 'idx_business_members_user_id',
        columnNames: ['user_id'],
      }),
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
      new TableIndex({
        name: 'idx_consultant_skills_skill_id',
        columnNames: ['skill_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('consultant_skills', true);
    await queryRunner.dropTable('consultant_profiles', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_skills_name_lower"`);
    await queryRunner.dropTable('skills', true);
    await queryRunner.dropTable('business_members', true);
    await queryRunner.dropTable('business_profiles', true);
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
