# Notifications — Consultant Event Catalog

> Audience: Lonaos (consultant platform) frontend engineers.
> All types below are delivered to the **specific consultant** the event concerns.
> Companion guides: [Integration Guide](../../notifications-service/notifications-realtime-api-specs.md) · [REST API](../../business-service/notifications/notifications-api-specs.md)

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
resources directly without a business context path. Several events also fall through to a `null`
`redirect_url` (every config whose `getRedirectUrl` keys off the recipient's `business_id`, which
is always `null` for consultants — e.g. all wallet/transaction events); the FE should rely on the
`(entity_type, entity_id)` fallback in that case.

---

## 1. `withdraw_completed`

**Trigger:** A consultant withdrawal to their connected Stripe account completes.

| Field          | Value                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| `type`         | `withdraw_completed`                                                                 |
| `entity_type`  | `transaction`                                                                        |
| `entity_id`    | `metadata.transaction_id`                                                            |
| `redirect_url` | `null` for consultants (the dispatcher's redirect builder requires a `business_id`). |

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

**Cache invalidation hint:** Reload the wallet balance widget and the transaction list. Route off the `(entity_type='transaction')` pair when navigating from the bell.

---

## 2. `withdraw_reversed`

**Trigger:** A previously completed consultant withdrawal is reversed. Fires from
[consultant-withdraw.strategy.ts](../../../../apps/consultant-service/src/modules/payments/consultant/consultant-withdraw.strategy.ts)
on a Stripe `payout.failed` / `transfer.reversed` webhook, or any other reversal path the webhook
processor handles. `metadata.new_balance` reflects the post-reversal balance, so the wallet widget
should redraw immediately on receipt.

| Field          | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| `type`         | `withdraw_reversed`                                           |
| `entity_type`  | `transaction`                                                 |
| `entity_id`    | `metadata.transaction_id`                                     |
| `redirect_url` | `null` for consultants (same reason as `withdraw_completed`). |

**Metadata:**

```ts
interface IWithdrawReversedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number; // amount originally withdrawn — now credited back
  currency: string;
  new_balance: number; // wallet balance after the reversal
  reason: string; // Stripe failure reason / admin note (rendered in the body copy)
}
```

**Cache invalidation hint:** Reload the wallet balance widget and the transaction list.

---

## 3. `consultant_project_skill_match`

**Trigger:** A new project is published whose required skills intersect the consultant's registered
skills. The dispatch is fan-out via a Bull queue — it may arrive seconds after the project goes
live, not instantly. The processor walks every matching consultant in 100-row pages
(`findUserIdsBySkillIds` with `LIMIT/OFFSET`) and dispatches in `Promise.allSettled` batches; **the
query does not order by `has_notification_priority`**, so delivery order between consultants is
effectively undefined within a batch.

| Field          | Value                                   |
| -------------- | --------------------------------------- |
| `type`         | `consultant_project_skill_match`        |
| `entity_type`  | `project`                               |
| `entity_id`    | `metadata.project_id`                   |
| `redirect_url` | `https://<lonaos>/projects/:project_id` |

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

## 4. `consultant_project_joined`

**Trigger:** The consultant is successfully added as an active member of a project.

| Field          | Value                                   |
| -------------- | --------------------------------------- |
| `type`         | `consultant_project_joined`             |
| `entity_type`  | `project`                               |
| `entity_id`    | `metadata.project_id`                   |
| `redirect_url` | `https://<lonaos>/projects/:project_id` |

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

## 5. `consultant_task_status_changed`

**Trigger:** The kanban status of a task assigned to the consultant changes.
This fires when the consultant themselves moves the task (IN_PROGRESS → IN_REVIEW, etc.), when
the 3+1 review workflow resolves (DONE, REVISION_REQUESTED, or PENDING_APPROVAL on cap-escalation),
or when an external action changes the status.

| Field          | Value                                                  |
| -------------- | ------------------------------------------------------ |
| `type`         | `consultant_task_status_changed`                       |
| `entity_type`  | `task`                                                 |
| `entity_id`    | `metadata.task_id`                                     |
| `redirect_url` | `https://<lonaos>/projects/:project_id/tasks/:task_id` |

**Metadata:**

```ts
interface IConsultantTaskStatusChangedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  old_status: string; // TaskKanbanStatus value before the change
  new_status: string; // TaskKanbanStatus value after the change
  // ── 3+1 review-workflow enrichment (optional, only on review-driven transitions) ──
  earned_amount?: string; // Decimal string, only when new_status='done'. Equals task.consultant_payout.
  feedback_summary?: string; // Consolidated reviewer + AI feedback, only when new_status='revision_requested'.
  revision_count?: number; // Cumulative count of revision rounds incurred so far.
  revisions_remaining?: number; // Rounds left before the 3-cap dispute escalation kicks in. 0 means next failure → dispute.
}
```

**Task kanban status values:** `to_do` · `assigned` · `in_progress` · `in_review` · `pending_approval` · `revision_requested` · `done` · `cancelled`

**Review-workflow scenarios:**

| `new_status`         | When                                                                                                  | Extra metadata populated                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `done`               | Both initial reviewers voted PASS **and** the AI quality check returned PASS.                         | `earned_amount`. A `consultant_transactions.CREDIT_CLEARED` row is created atomically. |
| `revision_requested` | Both initial reviewers voted FAIL, OR the round was 1-1 split (arbiter outcome), OR AI returned FAIL. | `feedback_summary`, `revision_count`, `revisions_remaining`.                           |
| `pending_approval`   | The 3-revision cap has been exceeded. A `task_disputes` row was opened for admin adjudication.        | `feedback_summary`, `revision_count`, `revisions_remaining=0`.                         |

**Cache invalidation hint:** Reload the kanban board for `project_id`, the task detail for `task_id`, and (when `earned_amount` is present) the consultant wallet / transactions panel so the credited balance and new ledger row appear immediately.

---

## 6. `consultant_onboarding_approved`

**Trigger:** An admin approves the consultant's onboarding (`OnboardingStatus → APPROVED`).
Emitted from `AdminConsultantOnboardingService.decide` AFTER the DB transaction that records the approval and flips `ConsultantProfile.isVerified = true`.

| Field          | Value                            |
| -------------- | -------------------------------- |
| `type`         | `consultant_onboarding_approved` |
| `entity_type`  | `onboarding`                     |
| `entity_id`    | `metadata.onboarding_id`         |
| `redirect_url` | `https://<lonaos>/skill-exams`   |

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
  "redirect_url": "https://lonaos.plys.dev/skill-exams"
}
```

**Cache invalidation hint:** Reload `GET /consultant/onboarding/status` and surface the skill-exam registration CTA.

---

## 7. `consultant_onboarding_rejected`

**Trigger:** An admin rejects the consultant's onboarding (`OnboardingStatus → REJECTED`).
Emitted from `AdminConsultantOnboardingService.decide` together with the rejection email.
The consultant is **blocked from re-onboarding for 3 months** — login, register, and profile-submit
all return `403 CONSULTANT_ONBOARDING_BLOCKED` while the block is active. See
[consultant account gates](../identity-service/auth/consultant-account-gates-api-specs.md) for the auth gate.

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| `type`         | `consultant_onboarding_rejected`                          |
| `entity_type`  | `onboarding`                                              |
| `entity_id`    | `metadata.onboarding_id`                                  |
| `redirect_url` | `https://<lonaos>/onboarding/blocked` (rejection landing) |

**Metadata:**

```ts
interface IConsultantOnboardingRejectedMetadata {
  onboarding_id: string;
  /** ISO-8601 — when the 3-month re-onboarding block lifts. */
  blocked_until: string;
  /** Admin's plain-text reason; null when omitted. */
  rejection_note: string | null;
}
```

**Sample payload:**

```json
{
  "type": "consultant_onboarding_rejected",
  "title": "Onboarding decision: not approved",
  "body": "Your onboarding was not approved. You can re-apply after 2026-08-14T10:11:00.000Z. Reason: Answers were too shallow — please re-apply with more concrete examples.",
  "metadata": {
    "onboarding_id": "550e8400-e29b-41d4-a716-446655440000",
    "blocked_until": "2026-08-14T10:11:00.000Z",
    "rejection_note": "Answers were too shallow — please re-apply with more concrete examples."
  },
  "entity_type": "onboarding",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "redirect_url": "https://lonaos.plys.dev/onboarding/blocked"
}
```

**Cache invalidation hint:** Reload `GET /consultant/onboarding/status`. Expect any in-flight session to start hitting `403 CONSULTANT_ONBOARDING_BLOCKED` on `/auth/login` for the next 3 months — clear local auth state and route to the blocked-onboarding landing.

---

## 8. `consultant_skill_exam_submitted`

**Trigger:** Consultant finalises a skill exam attempt (`status → SUBMITTED`). Confirms that the evaluation pipeline (Copyleaks → AI eval) has been kicked off — the consultant should not expect terminal status for a few minutes. The Lonaos UI surfaces this as the `PENDING_REVIEW` `consultant_view_status` returned by the skill-exam endpoints.

| Field          | Value                                   |
| -------------- | --------------------------------------- |
| `type`         | `consultant_skill_exam_submitted`       |
| `entity_type`  | `skill_exam`                            |
| `entity_id`    | `metadata.exam_id`                      |
| `redirect_url` | `https://<lonaos>/skill-exams/:exam_id` |

**Metadata:**

```ts
interface IConsultantSkillExamSubmittedMetadata {
  exam_id: string;
  skill_id: string;
  /** i18n skill key (e.g. "skill_react") — resolve via the skills i18n catalogue. */
  skill_name: string;
}
```

**Cache invalidation hint:** Reload `GET /consultant/skill-exams/current` and the exam detail for `exam_id`.

---

## 9. `consultant_skill_exam_passed`

**Trigger:** AI evaluation scores the exam ≥ 80% (`status → PASSED`). Emitted from `SkillExamAiEvaluationService` AFTER the transaction that upserts `ConsultantSkill { proficiencyLevel, rating }`, appends a `ConsultantSkillScore` row, recomputes `ConsultantProfile.avgRating`, and resets the platform-wide expired-attempt counter. Copy is keyed off `metadata.proficiency_level` (`senior` for 80–89, `expert` for ≥ 90).

`metadata.has_priority_benefit` is **driven by `avgRating ≥ 90`**, not the individual exam tier — the dispatcher reads `ConsultantProfile.hasNotificationPriority` (recomputed in the same transaction). A SENIOR-level pass that pushes the consultant's avg over 90 still flips the flag to `true`, and an EXPERT pass that drags the avg below 90 (rare) leaves it at `false`.

| Field          | Value                          |
| -------------- | ------------------------------ |
| `type`         | `consultant_skill_exam_passed` |
| `entity_type`  | `skill_exam`                   |
| `entity_id`    | `metadata.exam_id`             |
| `redirect_url` | `https://<lonaos>/skills`      |

**Metadata:**

```ts
interface IConsultantSkillExamPassedMetadata {
  exam_id: string;
  skill_id: string;
  skill_name: string;
  /** 0–100. */
  final_score: number;
  proficiency_level: 'senior' | 'expert';
  /** True when avgRating ≥ 90 (drives priority emails + push on new projects). */
  has_priority_benefit: boolean;
}
```

**Sample payload — senior (80 ≤ score < 90):**

```json
{
  "type": "consultant_skill_exam_passed",
  "title": "Skill exam passed — senior!",
  "body": "Nice work — you passed skill_react with 85.00% as senior.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "final_score": 85,
    "proficiency_level": "senior",
    "has_priority_benefit": false
  }
}
```

**Sample payload — expert (≥ 90, drives avgRating ≥ 90):**

```json
{
  "type": "consultant_skill_exam_passed",
  "title": "Skill exam passed — expert!",
  "body": "Outstanding — you passed skill_react with 92.50% as expert.",
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

## 10. `consultant_skill_exam_failed`

**Trigger:** Any one of three terminal failures:

- `LOW_SCORE` — AI eval scored < 80%. Emitted from `SkillExamAiEvaluationService` after the `FAILED` transition. `metadata.assigned_proficiency` is `'beginner'` (score < 40) or `'intermediate'` (40 ≤ score < 80). Per-skill cool-down is **30 days**.
- `COPYLEAKS_FAILED` — Copyleaks flagged the answers as AI-generated. Emitted from `SkillExamCopyleaksService` after the `COPYLEAKS_FAILED` transition and the strike-count increment. Per-skill cool-down is **7 days**. Pair with `consultant_account_banned` (section 12) on the 3rd strike.
- `EXPIRED` — the 60-minute exam timer ran out without a final submit. Emitted from `ConsultantSkillExamService.expireExam` (lazy or sweep). No per-skill cool-down; instead increments `users.exam_expired_count` and (on the 3rd expiration) sets a platform-wide 2-day pause.

`metadata.fail_reason` discriminates the three cases — title and body copy are picked from the reason. `metadata.cooldown_until` is `null` for the EXPIRED branch (no per-skill cooldown) and a non-null ISO timestamp for the other two. `metadata.strikes_remaining` is computed as `Math.max(0, 3 - strike_count)` in the event handler.

| Field          | Value                                   |
| -------------- | --------------------------------------- |
| `type`         | `consultant_skill_exam_failed`          |
| `entity_type`  | `skill_exam`                            |
| `entity_id`    | `metadata.exam_id`                      |
| `redirect_url` | `https://<lonaos>/skill-exams/:exam_id` |

**Metadata:**

```ts
interface IConsultantSkillExamFailedMetadata {
  exam_id: string;
  skill_id: string;
  skill_name: string;
  fail_reason: 'LOW_SCORE' | 'COPYLEAKS_FAILED' | 'EXPIRED';
  /** 0–100; 0 when Copyleaks fails before AI eval or when the exam EXPIRED. */
  final_score: number;
  /** ISO-8601 per-skill retake cooldown. Null for EXPIRED (no per-skill cool-down). */
  cooldown_until: string | null;
  /** users.ai_strike_count after this event. */
  strike_count: number;
  /** Math.max(0, 3 - strike_count). */
  strikes_remaining: number;
  /** Score-band level on LOW_SCORE fails. Null for COPYLEAKS_FAILED + EXPIRED. */
  assigned_proficiency: 'beginner' | 'intermediate' | null;
}
```

**Sample payload — `LOW_SCORE` (BEGINNER):**

```json
{
  "type": "consultant_skill_exam_failed",
  "title": "Skill exam result: did not pass",
  "body": "Your skill_react exam scored 35.00%, below the 80% pass threshold. You can retake after 2026-06-12T11:35:00.000Z.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "fail_reason": "LOW_SCORE",
    "final_score": 35,
    "cooldown_until": "2026-06-12T11:35:00.000Z",
    "strike_count": 0,
    "strikes_remaining": 3,
    "assigned_proficiency": "beginner"
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
    "strikes_remaining": 2,
    "assigned_proficiency": null
  }
}
```

**Sample payload — `EXPIRED`:**

```json
{
  "type": "consultant_skill_exam_failed",
  "title": "Skill exam expired",
  "body": "Your skill_react exam timer ran out before you submitted. After 3 expired attempts you will be paused from taking exams for 2 days.",
  "metadata": {
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "fail_reason": "EXPIRED",
    "final_score": 0,
    "cooldown_until": null,
    "strike_count": 0,
    "strikes_remaining": 3,
    "assigned_proficiency": null
  }
}
```

**Cache invalidation hint:** Reload the exam detail. If `fail_reason === 'COPYLEAKS_FAILED'`, reload the profile so the new strike count surfaces. If `fail_reason === 'EXPIRED'`, also reload `GET /consultant/skill-exams/eligibility` — the platform-wide block may have just activated. If `strikes_remaining === 0`, expect a `consultant_account_banned` event to arrive immediately after.

---

## 11. `password_changed`

**Trigger:** The consultant successfully changes their own password through `POST /auth/change-password`. Dispatched from [basic-auth.service.ts](../../../../apps/consultant-service/src/modules/auth/services/basic-auth.service.ts) on the same code path as business password changes — there is no consultant-specific variant. The same dispatch revokes every _other_ `user_sessions` row, so the live socket on the device that initiated the change stays connected, while every other device receives `error AUTH_TOKEN_INVALID` and is forced to re-authenticate.

| Field          | Value                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`         | `password_changed`                                                                                                                  |
| `entity_type`  | `user`                                                                                                                              |
| `entity_id`    | recipient `user_id`                                                                                                                 |
| `redirect_url` | `<ployos>/settings/security` — the dispatcher config has no `baseUrlKey: 'lonaosUrl'` for this type, so it defaults to `ployosUrl`. |

> The `redirect_url` currently routes to the Ployos base URL because no consultant-specific override is wired up. The FE may prefer the entity-mapping fallback (`user → /settings/security` on Lonaos) instead of following the link verbatim.

**Metadata:**

```ts
interface IPasswordChangedMetadata {
  /** From the request context — `x-device-id` header value at change time. */
  device_id: string | null;
  /** Resolved client IP at change time. */
  ip_address: string;
}
```

**Sample payload:**

```json
{
  "type": "password_changed",
  "title": "Password changed",
  "body": "Your password was just changed from a new device. If this wasn't you, reset your password immediately.",
  "metadata": { "device_id": "ios-3f9c…", "ip_address": "203.0.113.4" },
  "entity_type": "user",
  "entity_id": "00000000-0000-0000-0000-000000000099",
  "redirect_url": "https://ployos.plys.dev/settings/security"
}
```

**Cache invalidation hint:** None. Use this event as the trigger to render an in-app security toast / banner ("Password just changed from IP …"). Do not log out — sessions on the originating device are intentionally preserved.

---

## 12. `consultant_account_banned`

**Trigger:** The 3rd Copyleaks strike just landed. The system has set `User.isActive = false`, `User.bannedAt = now`, `User.banReason = 'AI_CONTENT_ABUSE'`, **and revoked every active `user_sessions` row** in the same transaction. Emitted AFTER the corresponding `consultant_skill_exam_failed` event for the same exam — render the timeline as **failed → banned**.

After this event lands, subsequent API calls from this user return `403 AUTH_ACCOUNT_INACTIVE` with `details.ban_reason`. The FE should sign the session out and route to a static "account disabled" page.

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
    case 'withdraw_reversed':
      qc.invalidateQueries({ queryKey: ['consultant', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['consultant', 'transactions'] });
      break;
    case 'consultant_project_skill_match':
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
      // The 3+1 review workflow finalised — refresh wallet/transactions
      // when an earnings credit landed.
      if (n.metadata.new_status === 'done' && n.metadata.earned_amount) {
        qc.invalidateQueries({ queryKey: ['consultant', 'wallet'] });
        qc.invalidateQueries({ queryKey: ['consultant', 'transactions'] });
      }
      break;
    case 'consultant_onboarding_approved':
      qc.invalidateQueries({ queryKey: ['consultant', 'onboarding', 'status'] });
      qc.invalidateQueries({ queryKey: ['consultant', 'profile'] });
      break;
    case 'consultant_onboarding_rejected':
      qc.clear();
      authStore.signOut();
      router.replace('/onboarding/blocked');
      break;
    case 'consultant_skill_exam_submitted':
      qc.invalidateQueries({ queryKey: ['consultant', 'skill-exams', 'current'] });
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
      qc.invalidateQueries({ queryKey: ['consultant', 'skill-exams', 'eligibility'] });
      break;
    case 'consultant_skill_exam_failed':
      qc.invalidateQueries({
        queryKey: ['consultant', 'skill-exams', n.metadata.exam_id],
      });
      qc.invalidateQueries({ queryKey: ['consultant', 'skill-exams', 'current'] });
      qc.invalidateQueries({ queryKey: ['consultant', 'skill-exams', 'eligibility'] });
      if (n.metadata.fail_reason === 'COPYLEAKS_FAILED') {
        qc.invalidateQueries({ queryKey: ['consultant', 'profile'] }); // strike count surface
      }
      break;
    case 'password_changed':
      // Don't log out — sessions on this device are intentionally preserved.
      // Surface an inline security banner / toast instead.
      showSecurityBanner({
        ip: n.metadata.ip_address,
        deviceId: n.metadata.device_id,
      });
      break;
    case 'consultant_account_banned':
      qc.clear();
      authStore.signOut();
      router.replace('/account-disabled');
      break;
  }
});
```
