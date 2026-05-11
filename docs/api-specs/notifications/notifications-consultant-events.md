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
  }
});
```
