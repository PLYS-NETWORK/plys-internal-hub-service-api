# Notifications — Admin Event Catalog

> Audience: Internal Hub (admin platform) frontend engineers.
> All 9 types below are **broadcast to every active admin** when the triggering action occurs.
> Companion guides: [Integration Guide](../../shared/notifications-realtime-api-specs.md) · [REST API](../../business/notifications/notifications-api-specs.md)

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

---

## 1. `admin_business_onboarded`

**Trigger:** A business user completes onboarding (fills in company name, industry, address, etc.).

| Field          | Value                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| `type`         | `admin_business_onboarded`                                                              |
| `entity_type`  | `user`                                                                                  |
| `entity_id`    | The admin's own `userId` (user-scoped; no single business entity owns the notification) |
| `redirect_url` | `https://<internal-hub>/businesses/:business_id`                                        |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                                                         |

**Metadata:**

```ts
interface IAdminBusinessOnboardedMetadata {
  business_id: string;
  business_name: string;
}
```

**Cache invalidation hint:** Reload the business list / business detail page for `business_id`.

---

## 2. `admin_project_published`

**Trigger:** Any project transitions to `PUBLISHED` status on the business platform.

| Field          | Value                                         |
| -------------- | --------------------------------------------- |
| `type`         | `admin_project_published`                     |
| `entity_type`  | `project`                                     |
| `entity_id`    | `metadata.project_id`                         |
| `redirect_url` | `https://<internal-hub>/projects/:project_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)               |

**Metadata:**

```ts
interface IAdminProjectPublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
  business_name: string;
}
```

**Cache invalidation hint:** Reload the admin project list and the project detail for `project_id`.

---

## 3. `admin_business_top_up`

**Trigger:** A business top-up transaction completes successfully (payment confirmed by Stripe).

| Field          | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| `type`         | `admin_business_top_up`                                       |
| `entity_type`  | `transaction`                                                 |
| `entity_id`    | `metadata.transaction_id`                                     |
| `redirect_url` | `https://<internal-hub>/businesses/:business_id/transactions` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                               |

**Metadata:**

```ts
interface IAdminBusinessTopUpMetadata {
  transaction_id: string;
  transaction_number: string;
  business_id: string;
  business_name: string;
  amount: number; // major currency units (e.g. 150.00)
  currency: string; // e.g. "USD"
}
```

**Cache invalidation hint:** Reload the business transaction list for `business_id`.

---

## 4. `admin_task_published`

**Trigger:** A task within any project is published (moves out of `DRAFT` status into `TO_DO`).

| Field          | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| `type`         | `admin_task_published`                                       |
| `entity_type`  | `task`                                                       |
| `entity_id`    | `metadata.task_id`                                           |
| `redirect_url` | `https://<internal-hub>/projects/:project_id/tasks/:task_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                              |

**Metadata:**

```ts
interface IAdminTaskPublishedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  project_code: string;
  business_name: string;
}
```

**Cache invalidation hint:** Reload the task list for `project_id`.

---

## 5. `admin_consultant_onboarding_submitted`

**Trigger:** A consultant finalises their onboarding interview (calls `POST /consultant/onboarding/interview/submit` and all answers land). Replaces the legacy `admin_consultant_interview_submitted` which referenced the now-removed `consultant-applications` schema.

| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| `type`         | `admin_consultant_onboarding_submitted`                        |
| `entity_type`  | `onboarding`                                                   |
| `entity_id`    | `metadata.onboarding_id`                                       |
| `redirect_url` | `https://<internal-hub>/consultant-onboardings/:onboarding_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                                |

**Metadata:**

```ts
interface IAdminConsultantOnboardingSubmittedMetadata {
  onboarding_id: string;
  consultant_user_id: string;
  consultant_name: string;
}
```

**Sample payload:**

```json
{
  "type": "admin_consultant_onboarding_submitted",
  "title": "Onboarding submitted: Jane Doe",
  "body": "Jane Doe has submitted their onboarding interview and is awaiting review.",
  "metadata": {
    "onboarding_id": "550e8400-e29b-41d4-a716-446655440000",
    "consultant_user_id": "0f3b9d24-1111-2222-3333-444455556666",
    "consultant_name": "Jane Doe"
  },
  "entity_type": "onboarding",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "redirect_url": "https://internal-hub.plys.dev/consultant-onboardings/550e8400-e29b-41d4-a716-446655440000"
}
```

**Cache invalidation hint:** Reload `GET /admin/onboardings?status=INTERVIEW_SUBMITTED` (the pending-review queue) and the detail screen for `onboarding_id`.

---

## 6. `admin_skill_exam_result`

**Trigger:** Every terminal transition of any consultant's skill-exam pipeline — PASSED, FAILED (LOW_SCORE), COPYLEAKS_FAILED, or EXPIRED. Admins use this as a real-time audit log of the automated grading pipeline.

Fired by `NotificationEventHandlerService.onConsultantSkillExamPassed` and `onConsultantSkillExamFailed`, which also dispatch the matching consultant-side notification. The dispatcher fans out to every active admin via `findActiveAdminUserIds()`.

| Field          | Value                                         |
| -------------- | --------------------------------------------- |
| `type`         | `admin_skill_exam_result`                     |
| `entity_type`  | `skill_exam`                                  |
| `entity_id`    | `metadata.exam_id`                            |
| `redirect_url` | `https://<internal-hub>/skill-exams/:exam_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)               |

**Metadata:**

```ts
interface IAdminSkillExamResultMetadata {
  /** Terminal outcome the admin should review. */
  outcome: 'PASSED' | 'LOW_SCORE' | 'COPYLEAKS_FAILED' | 'EXPIRED';
  exam_id: string;
  consultant_user_id: string;
  consultant_name: string;
  skill_id: string;
  skill_name: string;
  /** 0–100. 0 when CopyLeaks fails before AI eval or when the exam EXPIRED. */
  final_score: number;
  /** Set on PASSED only. */
  proficiency_level?: 'senior' | 'expert';
  /** Set on LOW_SCORE fails; null/absent for COPYLEAKS_FAILED + EXPIRED. */
  assigned_proficiency?: 'beginner' | 'intermediate' | null;
  /** ISO-8601 per-skill retake cooldown. Null for EXPIRED. */
  cooldown_until?: string | null;
  /** users.ai_strike_count after this event. */
  strike_count?: number;
}
```

**Sample payload — PASSED (expert):**

```json
{
  "type": "admin_skill_exam_result",
  "title": "Skill exam passed: Jane Doe",
  "body": "Jane Doe passed the skill_react exam (92.50%).",
  "metadata": {
    "outcome": "PASSED",
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "consultant_user_id": "0f3b9d24-...",
    "consultant_name": "Jane Doe",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "final_score": 92.5,
    "proficiency_level": "expert"
  }
}
```

**Sample payload — COPYLEAKS_FAILED (1st strike):**

```json
{
  "type": "admin_skill_exam_result",
  "title": "Skill exam COPYLEAKS_FAILED: Jane Doe",
  "body": "Jane Doe did not pass the skill_react exam (0.00%) — outcome: COPYLEAKS_FAILED.",
  "metadata": {
    "outcome": "COPYLEAKS_FAILED",
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "consultant_user_id": "0f3b9d24-...",
    "consultant_name": "Jane Doe",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "final_score": 0,
    "cooldown_until": "2026-05-19T11:35:00.000Z",
    "strike_count": 1,
    "assigned_proficiency": null
  }
}
```

**Sample payload — EXPIRED:**

```json
{
  "type": "admin_skill_exam_result",
  "title": "Skill exam EXPIRED: Jane Doe",
  "body": "Jane Doe did not pass the skill_react exam (0.00%) — outcome: EXPIRED.",
  "metadata": {
    "outcome": "EXPIRED",
    "exam_id": "11111111-1111-1111-1111-111111111111",
    "consultant_user_id": "0f3b9d24-...",
    "consultant_name": "Jane Doe",
    "skill_id": "22222222-2222-2222-2222-222222222222",
    "skill_name": "skill_react",
    "final_score": 0,
    "cooldown_until": null,
    "assigned_proficiency": null
  }
}
```

**Cache invalidation hint:** Reload `GET /admin/skill-exams` (filtered or unfiltered) and the detail for `exam_id`. The detail screen carries per-answer CopyLeaks + AI scores.

---

## 7. `admin_consultant_banned`

**Trigger:** A consultant's 3rd CopyLeaks strike just landed and the system has flipped `User.isActive = false`, set `ban_reason = 'AI_CONTENT_ABUSE'`, and revoked every active session for that user. Emitted AFTER the matching `admin_skill_exam_result` (`outcome: 'COPYLEAKS_FAILED'`) for the same exam — render the admin timeline as **flagged → banned**.

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| `type`         | `admin_consultant_banned`                          |
| `entity_type`  | `user`                                             |
| `entity_id`    | `metadata.consultant_user_id`                      |
| `redirect_url` | `https://<internal-hub>/users/:consultant_user_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                    |

**Metadata:**

```ts
interface IAdminConsultantBannedMetadata {
  consultant_user_id: string;
  consultant_name: string;
  ban_reason: 'AI_CONTENT_ABUSE';
  /** ISO-8601. */
  banned_at: string;
  /** Final strike count that triggered the ban (typically 3). */
  ai_strike_count: number;
}
```

**Sample payload:**

```json
{
  "type": "admin_consultant_banned",
  "title": "Consultant banned: Jane Doe",
  "body": "Jane Doe was banned after 3 CopyLeaks strikes (AI_CONTENT_ABUSE).",
  "metadata": {
    "consultant_user_id": "0f3b9d24-...",
    "consultant_name": "Jane Doe",
    "ban_reason": "AI_CONTENT_ABUSE",
    "banned_at": "2026-05-12T11:35:00.000Z",
    "ai_strike_count": 3
  },
  "entity_type": "user",
  "entity_id": "0f3b9d24-..."
}
```

**Cache invalidation hint:** Reload the consultant detail page and any pending-action lists that filtered the user.

---

## 8. `admin_consultant_project_joined`

**Trigger:** A consultant successfully applies to a project via `POST /projects/consultant/membership/:projectId/apply`. Fired once the membership row is committed (insert or LEFT→ACTIVE reactivate) and the calling consultant's explore caches have been invalidated.

| Field          | Value                                         |
| -------------- | --------------------------------------------- |
| `type`         | `admin_consultant_project_joined`             |
| `entity_type`  | `project`                                     |
| `entity_id`    | `metadata.project_id`                         |
| `redirect_url` | `https://<internal-hub>/projects/:project_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)               |

**Metadata:**

```ts
interface IAdminConsultantProjectJoinedMetadata {
  consultant_user_id: string;
  consultant_name: string;
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
  business_name: string;
}
```

**Sample payload:**

```json
{
  "type": "admin_consultant_project_joined",
  "title": "Consultant joined project: Jane Doe",
  "body": "Jane Doe joined project \"AI-powered support\" (PRJ-0042) owned by Acme Inc.",
  "metadata": {
    "consultant_user_id": "0f3b9d24-1111-2222-3333-444455556666",
    "consultant_name": "Jane Doe",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_code": "PRJ-0042",
    "project_title": "AI-powered support",
    "business_id": "a1b2c3d4-...",
    "business_name": "Acme Inc."
  },
  "entity_type": "project",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Cache invalidation hint:** Reload the project members / activity feed for `project_id`, and any "recently active consultants" admin dashboard that lists `consultant_user_id`.

---

## 9. `admin_consultant_project_left`

**Trigger:** A consultant leaves a project via `POST /projects/consultant/membership/:projectId/leave`. Fired once the membership row has been flipped to `LEFT` and the consultant's explore caches have been invalidated. Distinct from admin-initiated removals (which would land as a separate `REMOVED` event in a future step) — this signal indicates a voluntary departure.

| Field          | Value                                         |
| -------------- | --------------------------------------------- |
| `type`         | `admin_consultant_project_left`               |
| `entity_type`  | `project`                                     |
| `entity_id`    | `metadata.project_id`                         |
| `redirect_url` | `https://<internal-hub>/projects/:project_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)               |

**Metadata:**

```ts
interface IAdminConsultantProjectLeftMetadata {
  consultant_user_id: string;
  consultant_name: string;
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
  business_name: string;
}
```

**Sample payload:**

```json
{
  "type": "admin_consultant_project_left",
  "title": "Consultant left project: Jane Doe",
  "body": "Jane Doe left project \"AI-powered support\" (PRJ-0042) owned by Acme Inc.",
  "metadata": {
    "consultant_user_id": "0f3b9d24-1111-2222-3333-444455556666",
    "consultant_name": "Jane Doe",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_code": "PRJ-0042",
    "project_title": "AI-powered support",
    "business_id": "a1b2c3d4-...",
    "business_name": "Acme Inc."
  },
  "entity_type": "project",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Cache invalidation hint:** Reload the project members / activity feed for `project_id`. Capacity-watch dashboards (rosters with available slots) should also refresh — the project just freed a seat.

---

## 10. `task_reviewer_review_assigned`

> **Audience exception:** This notification targets **a single reviewer**, not the broadcast admin audience. It fires for users with role `TASK_REVIEWER` (and, indirectly, admins observing via the same Socket channel for their own user id). Documented here because the reviewer's UI is hosted on the Internal Hub admin platform.

**Trigger:** The 3+1 review workflow auto-assigns the reviewer to a task. Two flavours:

- Initial assignment when a consultant submits a task for review (2 reviewers per submission, `is_arbiter = false`).
- Arbiter assignment when the first two reviewers split 1-1 (`is_arbiter = true`).

| Field          | Value                                            |
| -------------- | ------------------------------------------------ |
| `type`         | `task_reviewer_review_assigned`                  |
| `entity_type`  | `task`                                           |
| `entity_id`    | `metadata.task_id`                               |
| `redirect_url` | `https://<internal-hub>/task-reviews/:review_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                  |

**Metadata:**

```ts
interface ITaskReviewerReviewAssignedMetadata {
  review_id: string; // UUID — task_reviews.id; matches GET /admin/task-reviews/:reviewId
  task_id: string;
  task_code: string; // e.g. "WEB-12"
  task_title: string;
  project_id: string;
  round_number: number; // matches tasks.last_review_round at assignment time
  is_arbiter: boolean; // true → assigned to break a 1-1 split; the vote contributes feedback only
}
```

**Sample payload (arbiter assignment):**

```json
{
  "type": "task_reviewer_review_assigned",
  "title": "New task review assigned",
  "body": "You've been asked to break a tie on WEB-12 (\"Implement product detail page\"), round 1.",
  "metadata": {
    "review_id": "22222222-2222-2222-2222-222222222222",
    "task_id": "11111111-1111-1111-1111-111111111111",
    "task_code": "WEB-12",
    "task_title": "Implement product detail page",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "round_number": 1,
    "is_arbiter": true
  },
  "entity_type": "task",
  "entity_id": "11111111-1111-1111-1111-111111111111",
  "redirect_url": "https://internal-hub.ployos.com/task-reviews/22222222-2222-2222-2222-222222222222"
}
```

**Cache invalidation hint:** Reload the pending-reviews queue (`GET /admin/task-reviews/pending`). The arbiter case can also surface in real time inside an open task-detail view — refresh `GET /admin/task-reviews/:review_id` for the affected task.

**Behavioural note for the FE:** an arbiter cannot flip the outcome — any 1-1 split resolves to `REVISION_REQUESTED` regardless of how the arbiter votes. Surface this clearly in the arbiter UI so the reviewer understands their vote contributes feedback, not the verdict.

---

## Retired admin events

The following admin notifications referenced the now-removed `consultant-applications` schema and are no longer emitted or wired. Existing notification rows of these types are still readable, but no new ones will arrive:

- `admin_consultant_interview_submitted` — **replaced by** `admin_consultant_onboarding_submitted` (section 5).
- `admin_consultant_ai_rejected` — **superseded by** `admin_skill_exam_result` with `outcome: 'COPYLEAKS_FAILED'` (section 6) and `admin_consultant_banned` on the 3-strike (section 7).

Frontends should drop their switch cases for these types — the dispatcher will never produce them again.

---

## React Query switch example

```ts
socket.on('notification.new', (n: NotificationPayload) => {
  switch (n.type) {
    case 'admin_business_onboarded':
      qc.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      qc.invalidateQueries({ queryKey: ['admin', 'businesses', n.metadata.business_id] });
      break;
    case 'admin_project_published':
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
      qc.invalidateQueries({ queryKey: ['admin', 'projects', n.metadata.project_id] });
      break;
    case 'admin_business_top_up':
      qc.invalidateQueries({
        queryKey: ['admin', 'businesses', n.metadata.business_id, 'transactions'],
      });
      break;
    case 'admin_task_published':
      qc.invalidateQueries({
        queryKey: ['admin', 'projects', n.metadata.project_id, 'tasks'],
      });
      break;
    case 'admin_consultant_onboarding_submitted':
      qc.invalidateQueries({ queryKey: ['admin', 'onboardings'] });
      qc.invalidateQueries({
        queryKey: ['admin', 'onboardings', n.metadata.onboarding_id],
      });
      break;
    case 'admin_skill_exam_result':
      qc.invalidateQueries({ queryKey: ['admin', 'skill-exams'] });
      qc.invalidateQueries({ queryKey: ['admin', 'skill-exams', n.metadata.exam_id] });
      break;
    case 'admin_consultant_banned':
      qc.invalidateQueries({ queryKey: ['admin', 'users', n.metadata.consultant_user_id] });
      qc.invalidateQueries({ queryKey: ['admin', 'skill-exams'] });
      break;
    case 'admin_consultant_project_joined':
    case 'admin_consultant_project_left':
      qc.invalidateQueries({ queryKey: ['admin', 'projects', n.metadata.project_id, 'members'] });
      qc.invalidateQueries({ queryKey: ['admin', 'projects', n.metadata.project_id, 'activity'] });
      break;
  }
});
```
