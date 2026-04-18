# Skills — Business Context

## Purpose
Owns the normalized, cross-industry skill taxonomy shared by every profile and project. Skills are stored as i18n keys, never English labels — translation happens at the frontend.

## Tables owned
- `skills` — one row per distinct skill. `name` column stores the key (`skill_react`, `skill_translation_en_tr`), `category` stores a category key (`category_frontend`).

## Key invariants
- **Case-insensitive uniqueness.** Functional unique index on `LOWER(name)`. "React" and "react" are the same skill.
- **Key format:** `^skill_[a-z0-9_]+$` — lowercase, snake_case, no diacritics. Translation-pair skills use ISO codes: `skill_translation_en_tr`. Software skills use vendor names: `skill_adobe_photoshop`.
- **Shared taxonomy.** Same rows referenced by `consultant_skills`, `project_required_skills`, and any future skill-linked table.
- **Every skill key must have translations** in both `src/i18n/en/skill.json` and `src/i18n/tr/skill.json`. The seed runner fails the build if any key is missing.
- **Cross-industry scope.** Not tech-only. Categories must span language, teaching, GIS, finance, legal, healthcare, engineering, trades, hospitality, etc. Source from ESCO taxonomy (https://esco.ec.europa.eu/en) — expect 800–2,000 rows.

## State machines
None.

## External dependencies
- **Seed runner** (`src/database/seeds/seed-runner.ts`) populates this table from `skills.json`. Idempotent — safe to re-run.
- **Consultant Profiles** — consultant_skills join table.
- **Projects** — project_required_skills join table.
- **i18n** — `skill.json` + `category.json` translation bundles must stay in sync with this table.

## Critical edge cases
- **Adding a skill via UI.** Allowed only for platform admins — consultants/businesses should never invent new keys (would fragment the taxonomy and skip translation).
- **Deleting a skill** will cascade into `consultant_skills` and `project_required_skills` via FK. Prefer soft-deprecation (add a `deprecated` flag at the service layer) over hard delete once the system is in production.
- **Renaming a key** is effectively a new key + data migration. The key is user-facing via translation keys; changing it silently breaks frontend lookups.
