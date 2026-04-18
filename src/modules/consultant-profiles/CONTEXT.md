# Consultant Profiles — Business Context

## Purpose
Owns the consultant-side profile and the many-to-many link to skills. A `ConsultantProfile` is created by a user to operate on the Consultant platform. One user → at most one ConsultantProfile.

## Tables owned
- `consultant_profiles` — biographical + availability metadata, concurrency limit.
- `consultant_skills` — (consultant, skill) junction with proficiency + years-with-skill.

## Key invariants
- **Unique per user.** `uq_consultant_profiles_user_id`.
- **`maxConcurrentProjects` default 5.** Enforced by trigger on `project_members` INSERT (see Domain 6). Limit counts only `project_members.status = active` rows where the project is `public` or `in_progress`.
- **`yearsOfExperience >= 0`** and **`maxConcurrentProjects >= 1`** — CHECK constraints at DB.
- **`availability`** ∈ `full_time | part_time | contract | unavailable`.
- **`proficiency_level`** in `consultant_skills` ∈ `beginner | intermediate | advanced | expert`, default `intermediate`.
- **Skills are referenced, not duplicated** — `consultant_skills.skill_id` points into the shared `skills` table. A consultant can hold many skills; a skill is shared by many consultants.

## State machines
None. Consultant profile is a mutable metadata row. Skill links are add/remove only.

## External dependencies
- **Auth** — resolves `userId`.
- **Skills** (shared taxonomy) — `consultant_skills.skill_id` FK.
- **Projects / Applications** — consultant discovery filters by required skills.
- **Tasks** — `assigned_to` points at `consultant_profiles.id`; concurrency limit enforced on insert into `project_members`, not tasks.
- **Wallets / Finance** — one wallet per consultant profile (Domain 8).

## Critical edge cases
- **Dropping the `unavailable` setting** must not bypass concurrency check — the trigger runs on every `project_members` insert regardless.
- **Case-insensitive skill lookup** — the `skills` table has a functional unique index on `LOWER(name)`. When searching by key, always normalize.
- **Lowering `maxConcurrentProjects` below current active count** — allowed; existing memberships are grandfathered. Only future inserts are blocked.
