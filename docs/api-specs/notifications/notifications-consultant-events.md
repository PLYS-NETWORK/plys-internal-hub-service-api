# Notifications — Consultant Event Catalog

> Audience: Lona (consultant platform) frontend engineers.
> All types below are delivered to the **specific consultant** the event concerns.
> Companion guides: [Integration Guide](./notifications-realtime-guide.md) · [REST API](./notifications-api-specs.md)

---

## Common payload shape

Every notification delivered via `notification.new` has this envelope regardless of type.
The `metadata` field is narrowed per type; see each section below.

```ts
interface NotificationPayload {
  id: string;
  type: string; // discriminator — one of the values below
  title: string; // i18n-resolved display title
  body: string; // i18n-resolved display body
  metadata: object; // type-specific — see each section
  entity_type: string;
  entity_id: string;
  redirect_url: string | null;
  is_read: boolean;
  read_at: string | null; // ISO-8601 or null
  created_at: string; // ISO-8601
  actor_id: string | null;
}
```

Redirect URLs on the consultant platform do **not** use a tenant prefix — consultants access
resources directly without a business context path.

---

## 1. `withdraw_completed`

**Trigger:** A consultant withdrawal to their connected Stripe account completes.

| Field          | Value                                 |
| -------------- | ------------------------------------- |
| `type`         | `withdraw_completed`                  |
| `entity_type`  | `transaction`                         |
| `entity_id`    | `metadata.transaction_id`             |
| `redirect_url` | `https://<lona>/billing/transactions` |

**Metadata:**

```ts
interface IWithdrawCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number; // major currency units (e.g. 100.00)
  currency: string; // e.g. "USD"
  new_balance: number;
}
```

**Cache invalidation hint:** Reload the wallet balance widget and the transaction list.

---

## 2. `consultant_project_skill_match`

**Trigger:** A new project is published whose required skills intersect the consultant's registered skills.
This notification is dispatched via an async Bull queue fan-out — it may arrive seconds after the
project goes live, not instantly.

| Field          | Value                                 |
| -------------- | ------------------------------------- |
| `type`         | `consultant_project_skill_match`      |
| `entity_type`  | `project`                             |
| `entity_id`    | `metadata.project_id`                 |
| `redirect_url` | `https://<lona>/projects/:project_id` |

**Metadata:**

```ts
interface IConsultantProjectSkillMatchMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
}
```

**Cache invalidation hint:** No mandatory refetch — the project was not in the consultant's list before;
optionally prepend it to the discovery feed or badge the "New projects" indicator.

---

## 3. `consultant_project_joined`

**Trigger:** The consultant is successfully added as an active member of a project.

| Field          | Value                                 |
| -------------- | ------------------------------------- |
| `type`         | `consultant_project_joined`           |
| `entity_type`  | `project`                             |
| `entity_id`    | `metadata.project_id`                 |
| `redirect_url` | `https://<lona>/projects/:project_id` |

**Metadata:**

```ts
interface IConsultantProjectJoinedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
}
```

**Cache invalidation hint:** Reload the consultant's active project list and the project detail.

---

## 4. `consultant_task_status_changed`

**Trigger:** The kanban status of a task assigned to the consultant changes.
This fires when the consultant themselves moves the task (IN_PROGRESS → IN_REVIEW, etc.) or when
an external action (e.g. business approval) changes the status.

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| `type`         | `consultant_task_status_changed`                     |
| `entity_type`  | `task`                                               |
| `entity_id`    | `metadata.task_id`                                   |
| `redirect_url` | `https://<lona>/projects/:project_id/tasks/:task_id` |

**Metadata:**

```ts
interface IConsultantTaskStatusChangedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  old_status: string; // TaskKanbanStatus value before the change
  new_status: string; // TaskKanbanStatus value after the change
}
```

**Task kanban status values:** `to_do` · `assigned` · `in_progress` · `in_review` · `pending_approval` · `revision_requested` · `done` · `cancelled`

**Cache invalidation hint:** Reload the kanban board for `project_id` and the task detail for `task_id`.

---

## 5. `consultant_onboarding_approved`

**Trigger:** An admin approves the consultant's onboarding application (`OnboardingStatus → APPROVED`).
Emitted from the admin-onboarding service after the DB transaction that sets the approval + `ConsultantProfile.isVerified = true`.

| Field          | Value                            |
| -------------- | -------------------------------- |
| `type`         | `consultant_onboarding_approved` |
| `entity_type`  | `onboarding`                     |
| `entity_id`    | `metadata.onboarding_id`         |
| `redirect_url` | `https://<lona>/skill-exams`     |

**Metadata:**

```ts
interface IConsultantOnboardingApprovedMetadata {
  onboarding_id: string;
}
```

**Sample payload (`title` / `body` are i18n-resolved):**

```json
{
  "type": "consultant_onboarding_approved",
  "title": "Your account has been verified",
  "body": "Welcome to Plys! Your account is verified — you can now register skills and take exams.",
  "metadata": { "onboarding_id": "550e8400-e29b-41d4-a716-446655440000" },
  "entity_type": "onboarding",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "redirect_url": "https://lona.plys.dev/skill-exams"
}
```

**Cache invalidation hint:** Reload `GET /consultant/onboarding/status` and surface the skill-exam registration CTA.

---

## 6. `consultant_skill_exam_submitted`

**Trigger:** Consultant finalises a skill exam attempt (`status → SUBMITTED`). Confirms that the evaluation pipeline (Copyleaks → AI eval) has been kicked off — the consultant should not expect terminal status for a few minutes.

| Field          | Value                                 |
| -------------- | ------------------------------------- |
| `type`         | `consultant_skill_exam_submitted`     |
| `entity_type`  | `skill_exam`                          |
| `entity_id`    | `metadata.exam_id`                    |
| `redirect_url` | `https://<lona>/skill-exams/:exam_id` |

**Metadata:**

```ts
interface IConsultantSkillExamSubmittedMetadata {
  exam_id: string;
  skill_id: string;
  /** i18n skill key (e.g. "skill_react") — resolve via the skills i18n catalogue. */
  skill_name: string;
}
```

**Sample payload:**

```json
{
  "type": "consultant_skill_exam_submitted",
  "title": "Skill exam submitted",
  "body": "Your skill_react exam is being evaluated. We'll notify you when it's done.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react"
  },
  "entity_type": "skill_exam",
  "entity_id": "11111111-1111-1111-1111-111111111111",
  "redirect_url": "https://lona.plys.dev/skill-exams/11111111-1111-1111-1111-111111111111"
}
```

**Cache invalidation hint:** Reload `GET /consultant/skill-exams` and the exam detail for `exam_id`.

---

## 7. `consultant_skill_exam_passed`

**Trigger:** AI evaluation scores the exam ≥ 80% (`status → PASSED`). Emitted from `SkillExamAiEvaluationService` AFTER the transaction that upserts `ConsultantSkill { proficiencyLevel, rating }`, appends a `ConsultantSkillScore` row, and recomputes `ConsultantProfile.avgRating`. The copy variant is keyed off `metadata.proficiency_level` (`advanced` for 80–89, `expert` for ≥ 90). The `expert` variant explicitly mentions the priority-promotion benefit.

| Field          | Value                          |
| -------------- | ------------------------------ |
| `type`         | `consultant_skill_exam_passed` |
| `entity_type`  | `skill_exam`                   |
| `entity_id`    | `metadata.exam_id`             |
| `redirect_url` | `https://<lona>/skills`        |

**Metadata:**

```ts
interface IConsultantSkillExamPassedMetadata {
  exam_id: string;
  skill_id: string;
  skill_name: string;
  /** 0–100. */
  final_score: number;
  proficiency_level: 'advanced' | 'expert';
  /** True iff proficiency_level === 'expert'. */
  has_priority_benefit: boolean;
}
```

**Sample payload — advanced (80 ≤ score < 90):**

```json
{
  "type": "consultant_skill_exam_passed",
  "title": "Skill exam passed!",
  "body": "Congratulations — you passed skill_react with 85.00% as advanced.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "final_score": 85,
    "proficiency_level": "advanced",
    "has_priority_benefit": false
  }
}
```

**Sample payload — expert (≥ 90):**

```json
{
  "type": "consultant_skill_exam_passed",
  "title": "Skill exam passed — expert!",
  "body": "Outstanding — you passed skill_react with 92.50% as expert. You'll now receive priority notifications when matching projects are published.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "final_score": 92.5,
    "proficiency_level": "expert",
    "has_priority_benefit": true
  }
}
```

**Cache invalidation hint:** Reload the consultant skill list (`GET /consultant/skills`), the consultant profile (so `avg_rating` + `has_notification_priority` update), and the exam detail.

---

## 8. `consultant_skill_exam_failed`

**Trigger:** Either path concludes the exam without passing:

- `LOW_SCORE` — AI eval scored < 80%. Emitted from `SkillExamAiEvaluationService` after the `FAILED` transition.
- `COPYLEAKS_FAILED` — Copyleaks flagged the answers as AI-generated. Emitted from `SkillExamCopyleaksService` after the `COPYLEAKS_FAILED` transition and the strike-count increment. Pair this notification with `consultant_account_banned` (section 9) on the 3rd strike.

`metadata.fail_reason` discriminates the two cases — title and body copy are picked from the reason. `metadata.cooldown_until` is the earliest retake timestamp (current behaviour: +7 days from the failure event, unless the account was just banned).

| Field          | Value                                 |
| -------------- | ------------------------------------- |
| `type`         | `consultant_skill_exam_failed`        |
| `entity_type`  | `skill_exam`                          |
| `entity_id`    | `metadata.exam_id`                    |
| `redirect_url` | `https://<lona>/skill-exams/:exam_id` |

**Metadata:**

```ts
interface IConsultantSkillExamFailedMetadata {
  exam_id: string;
  skill_id: string;
  skill_name: string;
  fail_reason: 'LOW_SCORE' | 'COPYLEAKS_FAILED';
  /** 0–100; 0 when Copyleaks fails before AI eval runs. */
  final_score: number;
  /** ISO-8601 — earliest retake timestamp. */
  cooldown_until: string;
  /** users.ai_strike_count after this event. */
  strike_count: number;
  /** 3 - strike_count, floored at 0. */
  strikes_remaining: number;
}
```

**Sample payload — `LOW_SCORE`:**

```json
{
  "type": "consultant_skill_exam_failed",
  "title": "Skill exam result: did not pass",
  "body": "Your skill_react exam scored 65.00%, below the 80% pass threshold. You can retake after 2026-05-19T11:35:00.000Z.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "fail_reason": "LOW_SCORE",
    "final_score": 65,
    "cooldown_until": "2026-05-19T11:35:00.000Z",
    "strike_count": 0,
    "strikes_remaining": 3
  }
}
```

**Sample payload — `COPYLEAKS_FAILED` (1st strike):**

```json
{
  "type": "consultant_skill_exam_failed",
  "title": "Skill exam flagged for AI-generated content",
  "body": "Your skill_react answers were flagged. You may retake after 2026-05-19T11:35:00.000Z. 2 attempt(s) remain before your account is permanently disabled.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "fail_reason": "COPYLEAKS_FAILED",
    "final_score": 0,
    "cooldown_until": "2026-05-19T11:35:00.000Z",
    "strike_count": 1,
    "strikes_remaining": 2
  }
}
```

**Sample payload — `COPYLEAKS_FAILED` (3rd strike — paired with `consultant_account_banned`):**

```json
{
  "type": "consultant_skill_exam_failed",
  "title": "Skill exam flagged for AI-generated content",
  "body": "Your skill_react answers were flagged. You may retake after 2026-05-19T11:35:00.000Z. 0 attempt(s) remain before your account is permanently disabled.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "fail_reason": "COPYLEAKS_FAILED",
    "final_score": 0,
    "cooldown_until": "2026-05-19T11:35:00.000Z",
    "strike_count": 3,
    "strikes_remaining": 0
  }
}
```

**Cache invalidation hint:** Reload the exam detail; if `fail_reason === 'COPYLEAKS_FAILED'` also reload the user profile so the new strike count surfaces. If `strikes_remaining === 0`, expect a `consultant_account_banned` event to arrive immediately after.

---

## 9. `consultant_account_banned`

**Trigger:** The 3rd Copyleaks strike just landed and the system has set `User.isActive = false`, `User.bannedAt = now`, `User.banReason = 'AI_CONTENT_ABUSE'`. Emitted AFTER the corresponding `consultant_skill_exam_failed` event for the same exam — render the timeline as **failed → banned**.

After this event lands, subsequent API calls from this user return `403 AUTH_ACCOUNT_INACTIVE`; the FE should sign the session out and route to a static "account disabled" page.

| Field          | Value                              |
| -------------- | ---------------------------------- |
| `type`         | `consultant_account_banned`        |
| `entity_type`  | `user`                             |
| `entity_id`    | recipient `user_id`                |
| `redirect_url` | `null` (no actionable destination) |

**Metadata:**

```ts
interface IConsultantAccountBannedMetadata {
  ban_reason: 'AI_CONTENT_ABUSE';
  /** ISO-8601. */
  banned_at: string;
}
```

**Sample payload:**

```json
{
  "type": "consultant_account_banned",
  "title": "Account permanently disabled",
  "body": "Your account has been permanently disabled after repeated AI-generated content violations. If you believe this is in error, contact support.",
  "metadata": {
    "ban_reason": "AI_CONTENT_ABUSE",
    "banned_at": "2026-05-12T11:35:00.000Z"
  },
  "entity_type": "user",
  "redirect_url": null
}
```

**Cache invalidation hint:** Clear all consultant-scoped caches, sign the session out, and route to the disabled-account screen.

---

## React Query switch example

```ts
socket.on('notification.new', (n: NotificationPayload) => {
  switch (n.type) {
    case 'withdraw_completed':
      qc.invalidateQueries({ queryKey: ['consultant', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['consultant', 'transactions'] });
      break;
    case 'consultant_project_skill_match':
      // Optional: badge the project discovery feed
      qc.invalidateQueries({ queryKey: ['consultant', 'projects', 'discovery'] });
      break;
    case 'consultant_project_joined':
      qc.invalidateQueries({ queryKey: ['consultant', 'projects', 'active'] });
      qc.invalidateQueries({
        queryKey: ['consultant', 'projects', n.metadata.project_id],
      });
      break;
    case 'consultant_task_status_changed':
      qc.invalidateQueries({
        queryKey: ['consultant', 'projects', n.metadata.project_id, 'board'],
      });
      qc.invalidateQueries({
        queryKey: ['consultant', 'tasks', n.metadata.task_id],
      });
      break;
    case 'consultant_onboarding_approved':
      qc.invalidateQueries({ queryKey: ['consultant', 'onboarding', 'status'] });
      qc.invalidateQueries({ queryKey: ['consultant', 'profile'] });
      break;
    case 'consultant_skill_exam_submitted':
      qc.invalidateQueries({ queryKey: ['consultant', 'skill-exams'] });
      qc.invalidateQueries({
        queryKey: ['consultant', 'skill-exams', n.metadata.exam_id],
      });
      break;
    case 'consultant_skill_exam_passed':
      qc.invalidateQueries({ queryKey: ['consultant', 'skills'] });
      qc.invalidateQueries({ queryKey: ['consultant', 'profile'] }); // avg_rating + priority flag
      qc.invalidateQueries({
        queryKey: ['consultant', 'skill-exams', n.metadata.exam_id],
      });
      break;
    case 'consultant_skill_exam_failed':
      qc.invalidateQueries({
        queryKey: ['consultant', 'skill-exams', n.metadata.exam_id],
      });
      if (n.metadata.fail_reason === 'COPYLEAKS_FAILED') {
        qc.invalidateQueries({ queryKey: ['consultant', 'profile'] }); // strike count surface
      }
      break;
    case 'consultant_account_banned':
      qc.clear(); // wipe all consultant-scoped caches
      authStore.signOut();
      router.replace('/account-disabled');
      break;
  }
});
```
