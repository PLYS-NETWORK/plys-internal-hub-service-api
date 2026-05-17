import { AppDataSource } from '@database/data-source';
import { AdminAllowedEmail } from '@database/entities/admin/admin-allowed-email.entity';
import { User } from '@database/entities/auth/user.entity';
import { Skill } from '@database/entities/profiles/skill.entity';
import { ActivePlatform, UserRole } from '@database/enums';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_ALLOWED_EMAILS: readonly string[] = [
  'huuphuc9410@gmail.com',
  'ngocthinh.dev@gmail.com',
  'yildsez@gmail.com',
];
const KEY_REGEX = /^(skill|category|industry)_[a-z0-9_]+$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillSeed {
  key: string;
  category_key: string;
}

interface CategorySeed {
  key: string;
}

interface IndustrySeed {
  key: string;
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedSkills(dataDir: string, i18nDir: string): Promise<void> {
  const categories = readJson<CategorySeed[]>(path.join(dataDir, 'skill-categories.json'));
  const skills = readJson<SkillSeed[]>(path.join(dataDir, 'skills.json'));
  const industries = readJson<IndustrySeed[]>(path.join(dataDir, 'industries.json'));

  console.log(
    `[skills] Loaded: ${categories.length} categories, ${skills.length} skills, ${industries.length} industries`,
  );

  validateKeyFormats(categories, skills, industries);
  validateTranslations(dataDir, i18nDir, categories, skills, industries);
  validateSkillCategories(categories, skills);

  const skillRepo = AppDataSource.getRepository(Skill);
  let inserted = 0;
  let updated = 0;

  // Upsert by LOWER(name) — relies on idx_skills_name_lower functional unique index.
  // Uses raw query builder because TypeORM's upsert() requires a column-level UNIQUE.
  for (const seed of skills) {
    const existing = await skillRepo
      .createQueryBuilder('s')
      .where('LOWER(s.name) = LOWER(:name)', { name: seed.key })
      .getOne();

    if (existing) {
      if (existing.category !== seed.category_key) {
        existing.category = seed.category_key;
        await skillRepo.save(existing);
        updated += 1;
      }
    } else {
      await skillRepo.save(skillRepo.create({ name: seed.key, category: seed.category_key }));
      inserted += 1;
    }
  }

  const distinctCategories = await skillRepo
    .createQueryBuilder('s')
    .select('COUNT(DISTINCT s.category)', 'count')
    .getRawOne<{ count: string }>();

  console.log(`[skills] ${inserted} inserted, ${updated} updated, ${skills.length} total`);
  console.log(`[skills] Distinct categories in DB: ${distinctCategories?.count ?? 0}`);
}

// Bootstraps every whitelisted email as both an `admin_allowed_emails` row and a
// passwordless `users` row with role=ADMIN_PLATFORM. Mirrors the shape produced by
// admin-auth.service.ts:findOrCreateAdminUser so a subsequent OTP login is a no-op.
async function seedAdminAllowedEmails(): Promise<void> {
  const allowedRepo = AppDataSource.getRepository(AdminAllowedEmail);
  const userRepo = AppDataSource.getRepository(User);
  let whitelistInserted = 0;
  let userInserted = 0;

  for (const rawEmail of ADMIN_ALLOWED_EMAILS) {
    const email = rawEmail.toLowerCase();

    // Atomic insert-if-not-exists: relies on uq_admin_allowed_emails_email.
    // Postgres' ON CONFLICT DO NOTHING avoids the SELECT-then-INSERT race and
    // returns the inserted row in `raw` only when a new row was written.
    const allowedInsert = await allowedRepo
      .createQueryBuilder()
      .insert()
      .into(AdminAllowedEmail)
      .values({ email, isActive: true })
      .orIgnore()
      .returning(['id'])
      .execute();
    if (Array.isArray(allowedInsert.raw) && allowedInsert.raw.length > 0) {
      whitelistInserted += 1;
      console.log(`[admin-whitelist] Seeded: ${email}`);
    } else {
      console.log(`[admin-whitelist] Already exists: ${email}`);
    }

    const existingUser = await userRepo
      .createQueryBuilder('u')
      .where('u.platform = :platform', { platform: ActivePlatform.ADMIN_PLATFORM })
      .andWhere('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
    if (existingUser) {
      console.log(`[admin-user] Already exists: ${email}`);
    } else {
      await userRepo.save(
        userRepo.create({
          email,
          platform: ActivePlatform.ADMIN_PLATFORM,
          role: UserRole.ADMIN_PLATFORM,
          passwordHash: null,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          isActive: true,
        }),
      );
      userInserted += 1;
      console.log(`[admin-user] Seeded: ${email}`);
    }
  }

  console.log(
    `[admin-whitelist] ${whitelistInserted} new whitelist, ${userInserted} new admin users (total whitelist: ${ADMIN_ALLOWED_EMAILS.length})`,
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateKeyFormats(
  categories: CategorySeed[],
  skills: SkillSeed[],
  industries: IndustrySeed[],
): void {
  const invalid: string[] = [
    ...categories.filter((c) => !KEY_REGEX.test(c.key)).map((c) => c.key),
    ...skills.filter((s) => !KEY_REGEX.test(s.key)).map((s) => s.key),
    ...industries.filter((i) => !KEY_REGEX.test(i.key)).map((i) => i.key),
  ];

  if (invalid.length > 0) {
    throw new Error(
      `Invalid key format (expected ^(skill|category|industry)_[a-z0-9_]+$): ${invalid.join(', ')}`,
    );
  }
}

function validateTranslations(
  _dataDir: string,
  i18nDir: string,
  categories: CategorySeed[],
  skills: SkillSeed[],
  industries: IndustrySeed[],
): void {
  const enSkill = readJson<Record<string, string>>(path.join(i18nDir, 'en', 'skill.json'));
  const trSkill = readJson<Record<string, string>>(path.join(i18nDir, 'tr', 'skill.json'));
  const enCategory = readJson<Record<string, string>>(path.join(i18nDir, 'en', 'category.json'));
  const trCategory = readJson<Record<string, string>>(path.join(i18nDir, 'tr', 'category.json'));
  const enIndustry = readJson<Record<string, string>>(path.join(i18nDir, 'en', 'industry.json'));
  const trIndustry = readJson<Record<string, string>>(path.join(i18nDir, 'tr', 'industry.json'));

  assertAllTranslated(
    'skill',
    skills.map((s) => s.key),
    enSkill,
    trSkill,
  );
  assertAllTranslated(
    'category',
    categories.map((c) => c.key),
    enCategory,
    trCategory,
  );
  assertAllTranslated(
    'industry',
    industries.map((i) => i.key),
    enIndustry,
    trIndustry,
  );
}

function validateSkillCategories(categories: CategorySeed[], skills: SkillSeed[]): void {
  const categoryKeys = new Set(categories.map((c) => c.key));
  const missing = skills.filter((s) => !categoryKeys.has(s.category_key));

  if (missing.length > 0) {
    throw new Error(
      `Skills reference undefined categories: ${missing.map((s) => `${s.key}→${s.category_key}`).join(', ')}`,
    );
  }
}

function assertAllTranslated(
  kind: string,
  keys: readonly string[],
  en: Record<string, string>,
  tr: Record<string, string>,
): void {
  const missingEn = keys.filter((k) => !(k in en));
  const missingTr = keys.filter((k) => !(k in tr));

  if (missingEn.length > 0 || missingTr.length > 0) {
    throw new Error(
      `Missing translations for ${kind}:\n  EN: ${missingEn.join(', ') || '(none)'}\n  TR: ${missingTr.join(', ') || '(none)'}`,
    );
  }
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const dataDir = path.resolve(__dirname, 'data');
  const i18nDir = path.resolve(__dirname, '..', '..', 'i18n');

  await AppDataSource.initialize();
  console.log('DataSource initialized');

  // Sync only on a developer's machine. Deployed envs (development + production) need real
  // tables before seeding, so run pending migrations here too — runMigrations() is idempotent
  // against the `migrations` table, so the app's own migrationsRun on startup becomes a no-op.
  if (process.env.NODE_ENV === 'local') {
    await AppDataSource.synchronize();
    console.log('Schema synchronized');
  } else {
    const executed = await AppDataSource.runMigrations();
    console.log(`Migrations applied: ${executed.length}`);
  }

  try {
    await seedSkills(dataDir, i18nDir);
    await seedAdminAllowedEmails();
  } finally {
    await AppDataSource.destroy();
  }

  console.log('Seed run complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
