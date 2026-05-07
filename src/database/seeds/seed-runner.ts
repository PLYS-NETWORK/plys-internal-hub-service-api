import { IAiKeysVersionedSecrets } from '@common/modules/environments/interfaces';
import { AppDataSource } from '@database/data-source';
import { AdminAllowedEmail } from '@database/entities/admin/admin-allowed-email.entity';
import { User } from '@database/entities/auth/user.entity';
import { AiProviderApiKey } from '@database/entities/infra/ai-provider-api-key.entity';
import { Skill } from '@database/entities/profiles/skill.entity';
import { ActivePlatform, AiProvider, UserRole } from '@database/enums';
import { GcmCipher } from '@modules/ai-provider-key/crypto/aes-gcm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'admin-platform@ployos.com';
const ADMIN_ALLOWED_EMAILS: readonly string[] = ['huuphuc9410@gmail.com'];
const BCRYPT_ROUNDS = 12;
const KEY_REGEX = /^(skill|category|industry)_[a-z0-9_]+$/;

const GROQ_API_KEY = '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';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_LABEL = 'Groq Llama 3.3 70B';
// Must match the LABEL constant inside MasterKeyCipher so the cipher can
// decrypt this ciphertext without modification.
const AI_KEYS_MASTER_LABEL = 'AI_KEYS_MASTER_KEY';

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

async function seedAdmin(): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);

  const existing = await userRepo.findOne({
    where: { email: ADMIN_EMAIL, platform: ActivePlatform.ADMIN_PLATFORM },
  });

  if (existing) {
    console.log(`[admin] Already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const password = process.env.ADMIN_SEED_PASSWORD ?? 'Admin@ployos2026!';
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = userRepo.create({
    email: ADMIN_EMAIL,
    platform: ActivePlatform.ADMIN_PLATFORM,
    role: UserRole.ADMIN_PLATFORM,
    passwordHash,
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
  });

  await userRepo.save(admin);
  console.log(`[admin] Seeded: ${ADMIN_EMAIL}`);
}

async function seedAdminAllowedEmails(): Promise<void> {
  const repo = AppDataSource.getRepository(AdminAllowedEmail);
  let inserted = 0;

  for (const email of ADMIN_ALLOWED_EMAILS) {
    const existing = await repo
      .createQueryBuilder('ae')
      .where('LOWER(ae.email) = LOWER(:email)', { email })
      .getOne();

    if (existing) {
      console.log(`[admin-whitelist] Already exists: ${email}`);
      continue;
    }

    await repo.save(repo.create({ email: email.toLowerCase(), isActive: true }));
    inserted += 1;
    console.log(`[admin-whitelist] Seeded: ${email}`);
  }

  console.log(
    `[admin-whitelist] ${inserted} inserted, ${ADMIN_ALLOWED_EMAILS.length - inserted} skipped`,
  );
}

function buildAiMasterSecrets(): IAiKeysVersionedSecrets {
  const currentVersion = parseInt(process.env.AI_KEYS_CURRENT_MASTER_VERSION ?? '1', 10);
  const versions: Record<number, string> = {};
  for (const [envKey, value] of Object.entries(process.env)) {
    const m = /^AI_KEYS_MASTER_KEY_v(\d+)$/.exec(envKey);
    if (m && value) versions[parseInt(m[1], 10)] = value;
  }
  if (!versions[currentVersion]) {
    throw new Error(`Env var AI_KEYS_MASTER_KEY_v${currentVersion} is not set`);
  }
  return { currentVersion, versions };
}

async function seedGroqApiKey(): Promise<void> {
  const repo = AppDataSource.getRepository(AiProviderApiKey);
  const userRepo = AppDataSource.getRepository(User);

  // Idempotent — skip if any Groq key already exists (active or not).
  const existing = await repo.findOne({ where: { provider: AiProvider.GROQ } });
  if (existing) {
    console.log('[groq-key] Already exists — skipped');
    return;
  }

  // createdBy is a non-nullable FK — resolve the admin user seeded just before.
  const admin = await userRepo.findOne({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error('[groq-key] Admin user not found — seedAdmin() must run first');
  }

  const secrets = buildAiMasterSecrets();
  const envelope = GcmCipher.encrypt(GROQ_API_KEY, secrets, AI_KEYS_MASTER_LABEL);
  // Inline MasterKeyCipher.serialise() — "v<N>:<iv_b64>:<tag_b64>:<ct_b64>"
  const keyCiphertext = `v${envelope.version}:${envelope.iv}:${envelope.tag}:${envelope.ciphertext}`;
  const keyLast4 = GROQ_API_KEY.slice(-4).padStart(4, '*');

  await repo.save(
    repo.create({
      provider: AiProvider.GROQ,
      model: GROQ_MODEL,
      label: GROQ_LABEL,
      masterKeyVersion: envelope.version,
      keyCiphertext,
      keyLast4,
      isActive: true,
      createdBy: admin.id,
    }),
  );

  console.log(
    `[groq-key] Seeded: provider=groq, model=${GROQ_MODEL}, last4=${keyLast4}, active=true`,
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
    await seedAdmin();
    await seedAdminAllowedEmails();
    await seedGroqApiKey();
  } finally {
    await AppDataSource.destroy();
  }

  console.log('Seed run complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
