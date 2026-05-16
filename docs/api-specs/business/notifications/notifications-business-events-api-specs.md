# Notifications — Business Event Catalog

> Audience: Ployos (business platform) frontend engineers.
> All types below are delivered to the **business user who owns the relevant resource**.
> Companion guides: [Integration Guide](../../shared/notifications-realtime-api-specs.md) · [REST API](./notifications-api-specs.md)

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

Redirect URL patterns use `/c/:businessId/` as the tenant prefix (where `businessId` is the
`BusinessProfile.id` associated with the recipient user).

---

## 1. `project_published`

**Trigger:** The business owner publishes one of their projects (status → `PUBLISHED`).

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| `type`         | `project_published`                                   |
| `entity_type`  | `project`                                             |
| `entity_id`    | `metadata.project_id`                                 |
| `redirect_url` | `https://<ployos>/c/:businessId/projects/:project_id` |

**Metadata:**

```ts
interface IProjectPublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
}
```

**Cache invalidation hint:** Reload the project list (`GET /projects/business`) and the project detail.

---

## 2. `project_unpublished`

**Trigger:** A project is unpublished or taken back to configuration mode.

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| `type`         | `project_unpublished`                                 |
| `entity_type`  | `project`                                             |
| `entity_id`    | `metadata.project_id`                                 |
| `redirect_url` | `https://<ployos>/c/:businessId/projects/:project_id` |

**Metadata:**

```ts
interface IProjectUnpublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  /** Only present when a pre-paid project was refunded on unpublish. */
  refund_amount?: number;
}
```

**Cache invalidation hint:** Reload project list, project detail, and billing transactions (if `refund_amount` is present).

---

## 3. `task_published`

**Trigger:** A task in one of the business owner's projects is published (moves from `DRAFT` to `TO_DO`).

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| `type`         | `task_published`                                                     |
| `entity_type`  | `task`                                                               |
| `entity_id`    | `metadata.task_id`                                                   |
| `redirect_url` | `https://<ployos>/c/:businessId/projects/:project_id/tasks/:task_id` |

**Metadata:**

```ts
interface ITaskPublishedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  project_code: string;
}
```

**Cache invalidation hint:** Reload the task list and task backlog for `project_id`.

---

## 4. `top_up_completed`

**Trigger:** A business top-up payment completes successfully.

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| `type`         | `top_up_completed`                                    |
| `entity_type`  | `transaction`                                         |
| `entity_id`    | `metadata.transaction_id`                             |
| `redirect_url` | `https://<ployos>/c/:businessId/billing/transactions` |

**Metadata:**

```ts
interface ITopUpCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number; // major currency units (e.g. 150.00)
  currency: string; // e.g. "USD"
  new_balance: number;
}
```

**Cache invalidation hint:** Reload the wallet balance widget and the transaction list.

---

## 5. `top_up_refunded`

**Trigger:** A business top-up is cancelled and the amount is refunded.

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| `type`         | `top_up_refunded`                                     |
| `entity_type`  | `transaction`                                         |
| `entity_id`    | `metadata.transaction_id`                             |
| `redirect_url` | `https://<ployos>/c/:businessId/billing/transactions` |

**Metadata:**

```ts
interface ITopUpRefundedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
}
```

**Cache invalidation hint:** Reload the wallet balance widget and the transaction list.

---

## 6. `withdraw_completed`

**Trigger:** A withdrawal to a connected Stripe account completes.

> Note: This type is shared with the consultant platform. For business users it fires on business-side withdrawals (if applicable); for consultants see the consultant event catalog.

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| `type`         | `withdraw_completed`                                  |
| `entity_type`  | `transaction`                                         |
| `entity_id`    | `metadata.transaction_id`                             |
| `redirect_url` | `https://<ployos>/c/:businessId/billing/transactions` |

**Metadata:**

```ts
interface IWithdrawCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
}
```

**Cache invalidation hint:** Reload the wallet balance widget and the transaction list.

---

## 7. `withdraw_reversed`

**Trigger:** A pending withdrawal is cancelled by the user or reversed by the system.

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| `type`         | `withdraw_reversed`                                   |
| `entity_type`  | `transaction`                                         |
| `entity_id`    | `metadata.transaction_id`                             |
| `redirect_url` | `https://<ployos>/c/:businessId/billing/transactions` |

**Metadata:**

```ts
interface IWithdrawReversedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
  reason: string;
}
```

**Cache invalidation hint:** Reload the wallet balance widget (amount is credited back) and the transaction list.

---

## React Query switch example

```ts
socket.on('notification.new', (n: NotificationPayload) => {
  switch (n.type) {
    case 'project_published':
    case 'project_unpublished':
      qc.invalidateQueries({ queryKey: ['business', 'projects'] });
      qc.invalidateQueries({ queryKey: ['business', 'projects', n.metadata.project_id] });
      if (n.type === 'project_unpublished' && n.metadata.refund_amount) {
        qc.invalidateQueries({ queryKey: ['business', 'wallet'] });
        qc.invalidateQueries({ queryKey: ['business', 'transactions'] });
      }
      break;
    case 'task_published':
      qc.invalidateQueries({
        queryKey: ['business', 'projects', n.metadata.project_id, 'tasks'],
      });
      break;
    case 'top_up_completed':
    case 'top_up_refunded':
    case 'withdraw_completed':
    case 'withdraw_reversed':
      qc.invalidateQueries({ queryKey: ['business', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['business', 'transactions'] });
      break;
  }
});
```
