# Notifications — Admin Event Catalog

> Audience: Internal Hub (admin platform) frontend engineers.
> All 6 types below are **broadcast to every active admin** when the triggering action occurs.
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

## 5. `admin_consultant_interview_submitted`

**Trigger:** A consultant finalises their interview (submits all answers and calls `finalizeInterview`).

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| `type`         | `admin_consultant_interview_submitted`                           |
| `entity_type`  | `application`                                                    |
| `entity_id`    | `metadata.application_id`                                        |
| `redirect_url` | `https://<internal-hub>/consultant-applications/:application_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                                  |

**Metadata:**

```ts
interface IAdminConsultantInterviewSubmittedMetadata {
  application_id: string;
  consultant_name: string;
}
```

**Cache invalidation hint:** Reload the application list and the application detail for `application_id`.

---

## 6. `admin_consultant_ai_rejected`

**Trigger:** Copyleaks AI detection flags an application — the application status transitions to `COPYLEAKS_FAILED`.

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| `type`         | `admin_consultant_ai_rejected`                                   |
| `entity_type`  | `application`                                                    |
| `entity_id`    | `metadata.application_id`                                        |
| `redirect_url` | `https://<internal-hub>/consultant-applications/:application_id` |
| `baseUrl`      | Internal Hub (`internalHubUrl`)                                  |

**Metadata:**

```ts
interface IAdminConsultantAiRejectedMetadata {
  application_id: string;
  consultant_name: string;
}
```

**Cache invalidation hint:** Reload the application detail for `application_id`; update status badge.

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
    case 'admin_consultant_interview_submitted':
    case 'admin_consultant_ai_rejected':
      qc.invalidateQueries({ queryKey: ['admin', 'applications'] });
      qc.invalidateQueries({
        queryKey: ['admin', 'applications', n.metadata.application_id],
      });
      break;
  }
});
```
