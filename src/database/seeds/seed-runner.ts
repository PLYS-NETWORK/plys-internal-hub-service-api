import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';

import { AppDataSource } from '../data-source';
import { Skill } from '../entities/profiles/skill.entity';

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

const KEY_REGEX = /^(skill|category|industry)_[a-z0-9_]+$/;

// Loads JSON seed payloads, validates that every key has matching EN+TR
// translations, and upserts into the database. Safe to re-run — uses
// LOWER(name) functional unique index for idempotency on the skills table.
async function main(): Promise<void> {
  const dataDir = path.resolve(__dirname, 'data');
  const i18nDir = path.resolve(__dirname, '..', '..', 'i18n');

  const categories = readJson<CategorySeed[]>(path.join(dataDir, 'skill-categories.json'));
  const skills = readJson<SkillSeed[]>(path.join(dataDir, 'skills.json'));
  const industries = readJson<IndustrySeed[]>(path.join(dataDir, 'industries.json'));

  console.log(
    `Loaded: ${categories.length} categories, ${skills.length} skills, ${industries.length} industries`,
  );

  // Validate key formats
  const invalid: string[] = [];
  for (const c of categories) if (!KEY_REGEX.test(c.key)) invalid.push(c.key);
  for (const s of skills) if (!KEY_REGEX.test(s.key)) invalid.push(s.key);
  for (const i of industries) if (!KEY_REGEX.test(i.key)) invalid.push(i.key);
  if (invalid.length > 0) {
    throw new Error(
      `Invalid key format (expected ^(skill|category|industry)_[a-z0-9_]+$): ${invalid.join(', ')}`,
    );
  }

  // Validate translation completeness
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

  // Validate that every skill's category exists
  const categoryKeys = new Set(categories.map((c) => c.key));
  const missingCats = skills.filter((s) => !categoryKeys.has(s.category_key));
  if (missingCats.length > 0) {
    throw new Error(
      `Skills reference undefined categories: ${missingCats.map((s) => `${s.key}→${s.category_key}`).join(', ')}`,
    );
  }

  // Initialize DataSource
  await AppDataSource.initialize();
  console.log('DataSource initialized');

  try {
    const skillRepo = AppDataSource.getRepository(Skill);
    let inserted = 0;
    let updated = 0;

    // Upsert by LOWER(name) — relies on idx_skills_name_lower functional unique index.
    // Use raw SQL because TypeORM's upsert wants a column-level UNIQUE.
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
    console.log(`Skills: ${inserted} inserted, ${updated} updated, ${skills.length} total`);

    // Sanity: distinct categories represented in DB
    const distinctCategories = await skillRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.category)', 'count')
      .getRawOne<{ count: string }>();
    console.log(`Distinct categories represented: ${distinctCategories?.count ?? 0}`);
  } finally {
    await AppDataSource.destroy();
  }

  console.log('Seed run complete');
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
