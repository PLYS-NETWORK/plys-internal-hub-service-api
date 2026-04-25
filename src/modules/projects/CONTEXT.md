# Projects — Business Context

## Purpose
Owns the top-level container under which tasks live and consultants are recruited. A project is created by a business and progresses through a strict status machine enforced at the database level.

## Tables owned
- `projects` — top-level project metadata, status, required consultant count.
- `project_required_skills` — junction (project, skill, is_mandatory).
- `project_interview_questions` — screening questions shown to applicants.
- `project_status_history` — append-only log of every status transition (auto-written by DB trigger).

## Project entity fields
| Column | Type | Notes |
|---|---|---|
| `title` | varchar(300) | Required |
| `introduction` | jsonb | Optional rich-text editor document (TipTap/ProseMirror JSON tree); `null` when not provided |
| `status` | varchar(20) | Enforced by DB trigger |
| `required_consultants` | smallint | Default 1 |
| `published_at` | timestamptz | Auto-stamped by trigger on → `public` |
| `started_at` | timestamptz | Auto-stamped on → `in_progress` |
| `completed_at` | timestamptz | Auto-stamped on → `done` |
| `cancelled_at` | timestamptz | Auto-stamped on → `cancelled` |

---

## Status machine

```
draft → setting_up → configured → public → in_progress → done
                                                     ↗
                              (any non-terminal) → cancelled
```

**Code constants** (in `BusinessProjectService`):
- `SETUP_STATUSES`: `{ DRAFT, SETTING_UP, CONFIGURED }` — project is editable, status auto-derived on save.
- `LOCKED_STATUSES`: `{ PUBLIC, IN_PROGRESS, DONE, CANCELLED }` — project is read-only; status changes only via explicit transitions.

**Status auto-derivation** (`deriveStatusFromSetup`) — runs on every create/update while in a setup status:
1. `DRAFT` → if title is blank or project just created with no extras.
2. `SETTING_UP` → title set, but tasks or skills are missing.
3. `CONFIGURED` → title + at least one task + at least one required skill are present.

**Important:** The DB trigger (`trg_enforce_project_status`) rejects any UPDATE that doesn't match the allowed transition map. App code never validates transitions itself.

---

## Publish workflow

Two-step: `validatePublish` (read-only check) → `confirmPublish` (write).

### Step 1 — `POST /business/projects/:id/validate-publish`
Returns `PublishValidationResponseDto`:
```json
{
  "can_publish": true,
  "reason_code": null,
  "account_balance": 10000.00,
  "project_amount": 5000.00,
  "payment_type": "pre-paid"
}
```

**Eligibility checks (in order):**
1. Project must be owned by the calling business.
2. Status must be `CONFIGURED` — any other status → `reason_code: "project_not_configured"`.
3. Must have at least one task with a price set.
4. **Payment type determination:**
   - `pre-paid` — if `businessProfile.accountBalance > 0` (business has topped up).
   - `credit` — if balance is 0 (credit-based; invoice sent monthly by the billing module).
5. For `pre-paid` only: balance must be ≥ `taskTotal × (1 + commissionRate)` — if insufficient → `reason_code: "insufficient_balance"`, `can_publish: false`.

### Step 2 — `POST /business/projects/:id/confirm-publish`
Guards: `@Roles(UserRole.USER)` + `@Platform(ActivePlatform.BUSINESS)`.

**For `pre-paid` businesses (in a DB transaction):**
1. Re-run eligibility check (idempotency guard — balance may have changed).
2. Compute: `commissionRate = businessProfile.commissionRate` (default 0.25).
3. `commissionAmount = taskTotal × commissionRate`.
4. `totalAmount = taskTotal + commissionAmount`.
5. Deduct `totalAmount` from `businessProfile.accountBalance`.
6. Save deducted balance.
7. Create `BusinessTransaction` record:
   - `type: PROJECT_PUBLISHED`
   - `amount: taskTotal` (subtotal before commission)
   - `commissionRate`, `commissionAmount`, `totalAmount`
   - `status: COMPLETED`
8. Set `project.status = PUBLIC` (DB trigger stamps `published_at`).
9. Send **receipt email** (`sendProjectPublishedReceiptEmail`) with full breakdown: subtotal, commission rate %, commission amount, total charged.

**For `credit` businesses (in a DB transaction):**
1. Set `project.status = PUBLIC` (no charge).
2. Send **success email** (`sendProjectPublishedSuccessEmail`).

Email failures are swallowed (logged as error) — the publish itself is never rolled back for email issues.

---

## Business API (`BusinessProjectService`)

| Method | Route | Description |
|---|---|---|
| `createProject` | `POST /business/projects` | Create project; inline tasks, skills, questions created atomically |
| `listMyProjects` | `GET /business/projects` | Paginated list with sort/filter |
| `getProject` | `GET /business/projects/:id` | Full project detail with tasks, skills, questions |
| `updateProject` | `PUT /business/projects/:id` | Update fields; forbidden on LOCKED_STATUSES |
| `deleteProject` | `DELETE /business/projects/:id` | Hard delete; forbidden on LOCKED_STATUSES |
| `updateProjectStatus` | `PATCH /business/projects/:id/status` | Manual status override (e.g. `in_progress → done`) |
| `validatePublish` | `POST /business/projects/:id/validate-publish` | Check publish eligibility (read-only) |
| `confirmPublish` | `POST /business/projects/:id/confirm-publish` | Execute publish; charges pre-paid balance |
| `listProjectMembers` | `GET /business/projects/:id/members` | Paginated list of accepted consultants |

### Create/Update project — inline sub-resources
Tasks, required skills, and interview questions are managed atomically inside the project create/update transaction:
- `ProjectTasksService.createForProject` / `replaceForProject` — full replace on update.
- `ProjectRequiredSkillsService.createForProject` / `replaceForProject` — full replace on update.
- `ProjectInterviewQuestionsService.createForProject` / `replaceForProject` — full replace on update.

### CreateProjectDto fields
```
title (required), introduction?, required_consultants?, skills[], interview_questions[], tasks[]
```

Each task item: `title, description?, price` (price stored in task entity, summed for `projectAmount`).

---

## Consultant API (`ConsultantProjectService`)

| Method | Route | Description |
|---|---|---|
| `listPublicProjects` | `GET /consultant/projects` | Projects in `PUBLIC` or `IN_PROGRESS` status |
| `getProject` | `GET /consultant/projects/:id` | Project detail (public/in-progress only) |

Consultants see projects only after they are `PUBLIC`. Once `IN_PROGRESS`, still visible (for active work). `DONE`/`CANCELLED` are hidden from discovery.

---

## Payment integration

| Business type | Publish charge | Invoice |
|---|---|---|
| Pre-paid (`accountBalance > 0`) | Immediate deduction from balance (totalAmount incl. commission) | Receipt email |
| Credit (`accountBalance = 0`) | No charge at publish | Monthly invoice via BillingModule |

Commission is stored per-business on `business_profiles.commission_rate` (numeric 5,4 — default `0.2500` = 25%). The rate is snapshotted into `business_transactions.commission_rate` at publish time so historical records are stable even if the rate changes.

---

## Key invariants
- **Status transitions are DB-enforced.** `trg_enforce_project_status` rejects any UPDATE that doesn't match the allowed transition map. App code MUST NOT validate transitions itself — relying on the trigger keeps behaviour consistent.
- **Lifecycle timestamps auto-stamp.** `published_at`, `started_at`, `completed_at`, `cancelled_at` are set by the DB trigger — no app code needed.
- **History is auto-written.** An AFTER UPDATE trigger inserts a `project_status_history` row from OLD/NEW values.
- **Budget range valid.** CHECK: `budget_max >= budget_min` when both set.
- **`required_consultants >= 1`.** Enforced by DB schema.
- **Sub-resources replace on update.** Tasks, skills, and questions are full-replace (delete + re-insert) on every `updateProject` call — no partial patch.
- **Ownership always checked.** Every business API call calls `resolveBusinessId()` and filters by `businessId`; mismatched projects return 404 (not 403) to avoid leaking IDs.

## External dependencies
- **BusinessProfile** (FK, `ON DELETE RESTRICT`) — commission rate is read from `business_profiles.commission_rate` at publish time.
- **Skills** — `project_required_skills` drives consultant discovery filter in the Applications module.
- **Tasks module** — every task belongs to exactly one project; task prices sum to `projectAmount`.
- **Applications module** — `project_members` links consultants to in-progress projects.
- **BillingModule** — credit-based businesses accumulate task settlements into monthly invoices; the project serves as the cost centre.
- **EmailService** — receipt email (pre-paid) or success email (credit) on `confirmPublish`.

## Critical edge cases
- **Double-publish guard.** `confirmPublish` re-checks eligibility inside the transaction. If two concurrent calls race, the second will fail the balance check (pre-paid) or succeed idempotently (credit — setting PUBLIC twice is a no-op via DB trigger rejection on same-status transitions).
- **Cancelling mid-flight.** Allowed from `DRAFT`, `SETTING_UP`, `CONFIGURED`, `PUBLIC`, `IN_PROGRESS`. DB trigger stamps `cancelled_at`. Active task assignments are NOT automatically cancelled — handled separately by the Tasks module.
- **Editing sub-resources on a published project.** Skills and interview questions can be updated after `PUBLIC` (the project itself is locked, but the junction tables are not). This may change consultant discovery exposure. Tasks cannot be added/removed after `PUBLIC` (locked by the task module's own guards).
- **Balance precision.** All monetary values are stored as `numeric(12,2)` strings. Arithmetic uses `Number()` and `.toFixed(2)` before persistence to avoid floating-point drift.
