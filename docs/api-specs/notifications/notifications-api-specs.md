# NotificationsController — API Specs

> **Source:** [src/modules/notifications/notifications.controller.ts](../../../src/modules/notifications/notifications.controller.ts)
> **Base path:** `/notifications`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Realtime companion:** the live `notification.new` socket payload mirrors `NotificationResponseDto` exactly — see [notifications-realtime-guide.md](./notifications-realtime-guide.md).

## Cross-cutting errors

| HTTP | error_code                   | When                                                         |
| ---- | ---------------------------- | ------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token.                                |
| 403  | `BUSINESS_PROFILE_NOT_FOUND` | Caller has no active business profile (PlatformGuard).       |
| 404  | `NOTIFICATION_NOT_FOUND`     | Notification id does not exist or does not belong to caller. |
| 422  | (validation)                 | DTO shape failures (UUID, integer bounds).                   |

## Endpoints

### 1. List my notifications (cursor-paginated)

- **Endpoint:** `GET /notifications/me`
- **Method:** `GET`
- **Query params:** [`ListNotificationsDto`](../../../src/modules/notifications/dto/requests/list-notifications.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `cursor` | `string` | no | Opaque base64 token from a previous response's `next_cursor`. Omit for the first page. |
  | `take` | `number` | no | Default 20, min 1, max 50. |
  | `unread` | `boolean` | no | When `true`, restrict to `is_read = false`. |
- **Response 200:** `NotificationCursorPageDto`

  ```json
  {
    "data": [
      /* NotificationResponseDto[] */
    ],
    "next_cursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA1LTAyVDIwOjE1OjAwLjAwMFoiLCJpZCI6Ii4uLiJ9",
    "has_more": true
  }
  ```

  Each item is a [`NotificationResponseDto`](../../../src/modules/notifications/dto/responses/notification-response.dto.ts) — see §Appendix for one worked example per `type`.

  **Pagination contract:** rows are ordered `(created_at DESC, id DESC)`. Pass `next_cursor` back as `cursor` for the next page. When the server returns `next_cursor: null` (or `has_more: false`), there are no more rows.

- **Errors:** cross-cutting only.

### 2. Unread count (Redis-cached)

- **Endpoint:** `GET /notifications/me/unread-count`
- **Method:** `GET`
- **Response 200:** [`UnreadCountResponseDto`](../../../src/modules/notifications/dto/responses/unread-count-response.dto.ts)
  ```json
  { "unread_count": 7 }
  ```
- **Performance:** the value is served from Redis key `notif:unread:{userId}` when the cache is warm; on a cache miss the server runs a single `COUNT(*)` over the partial unread index `idx_notifications_user_unread` and writes the result back to Redis (TTL 24h). Both paths return in single-digit ms.
- **Errors:** cross-cutting only.

### 3. Mark one notification as read

- **Endpoint:** `PATCH /notifications/me/:id/read`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4)
- **Response 200:** [`NotificationResponseDto`](../../../src/modules/notifications/dto/responses/notification-response.dto.ts) — the (now-read) notification.
- **Idempotency:** the call is idempotent. The Redis unread-count cache is decremented only on the first `false → true` transition. Calling twice returns the same row both times with `is_read: true`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `NOTIFICATION_NOT_FOUND` | Row does not exist or does not belong to the caller. |

### 4. Mark every unread notification as read

- **Endpoint:** `PATCH /notifications/me/read-all`
- **Method:** `PATCH`
- **Response 200:** [`MarkAllReadResponseDto`](../../../src/modules/notifications/dto/responses/mark-all-read-response.dto.ts)
  ```json
  { "updated_count": 7 }
  ```
  When already up to date, returns `updated_count: 0` (still 200).
- **Errors:** cross-cutting only.

> **No DELETE endpoint** — notifications are an append-only log on the BE side; the FE manages "dismissal" via the `is_read` flag. A cron retention pass (planned in v1.5) prunes rows older than 90d AND `is_read = true`.

---

## Appendix — example `NotificationResponseDto` per `type`

The shape of `metadata` is determined by the discriminator `type`. The FE imports the
[`NotificationPayload`](../../../src/modules/notifications/types/notification-metadata.types.ts) discriminated union
and switches on `n.type` to narrow `n.metadata` automatically.

### `profile_updated`

```json
{
  "id": "0f3b9d24-...-aa01",
  "type": "profile_updated",
  "title": "Profile updated",
  "body": "Your profile was updated. Changed: company_name, industry",
  "metadata": { "updated_fields": ["company_name", "industry"] },
  "entity_type": "user",
  "entity_id": "<recipient userId>",
  "redirect_url": "https://ployos.example/c/<businessId>/settings/profile",
  "is_read": false,
  "read_at": null,
  "created_at": "2026-05-02T20:15:00.000Z",
  "actor_id": "<actor userId or null>"
}
```

### `password_changed`

```json
{
  "type": "password_changed",
  "title": "Password changed",
  "body": "Your password was changed. If this wasn't you, secure your account immediately.",
  "metadata": { "device_id": "macbook-001", "ip_address": "203.0.113.42" },
  "entity_type": "user",
  "entity_id": "<recipient userId>",
  "redirect_url": "https://ployos.example/c/<businessId>/settings/security",
  "...": "..."
}
```

### `project_published`

```json
{
  "type": "project_published",
  "title": "Project published",
  "body": "Your project \"Backend platform\" (PR-0042) is now live and accepting applications.",
  "metadata": {
    "project_id": "0f3b9d24-...-bb22",
    "project_code": "PR-0042",
    "project_title": "Backend platform"
  },
  "entity_type": "project",
  "entity_id": "0f3b9d24-...-bb22",
  "redirect_url": "https://ployos.example/c/<businessId>/projects/0f3b9d24-...-bb22",
  "...": "..."
}
```

### `project_unpublished`

```json
{
  "type": "project_unpublished",
  "title": "Project unpublished",
  "body": "Your project \"Backend platform\" (PR-0042) is back in configuration mode.",
  "metadata": {
    "project_id": "0f3b9d24-...-bb22",
    "project_code": "PR-0042",
    "project_title": "Backend platform",
    "refund_amount": 1250.0
  },
  "entity_type": "project",
  "entity_id": "0f3b9d24-...-bb22",
  "redirect_url": "https://ployos.example/c/<businessId>/projects/0f3b9d24-...-bb22"
}
```

> `refund_amount` is omitted for CREDIT-path republishes (no money moved).

### `new_application`

```json
{
  "type": "new_application",
  "title": "New application received",
  "body": "Jane Doe just applied to your project \"Backend platform\".",
  "metadata": {
    "project_id": "0f3b9d24-...-bb22",
    "project_code": "PR-0042",
    "project_title": "Backend platform",
    "application_id": "0f3b9d24-...-cc33",
    "consultant_id": "0f3b9d24-...-dd44",
    "consultant_name": "Jane Doe"
  },
  "entity_type": "application",
  "entity_id": "0f3b9d24-...-cc33",
  "redirect_url": "https://ployos.example/c/<businessId>/projects/0f3b9d24-...-bb22/applications/0f3b9d24-...-cc33",
  "actor_id": "<consultant userId>"
}
```

### `top_up_completed`

```json
{
  "type": "top_up_completed",
  "title": "Top-up successful",
  "body": "Your top-up of 500.00 USD was credited to your account.",
  "metadata": {
    "transaction_id": "0f3b9d24-...-ee55",
    "transaction_number": "PLS-TU-202605-000123",
    "amount": 500.0,
    "currency": "USD",
    "new_balance": 1750.0
  },
  "entity_type": "transaction",
  "entity_id": "0f3b9d24-...-ee55",
  "redirect_url": "https://ployos.example/c/<businessId>/billing/transactions",
  "actor_id": null
}
```

### `withdraw_completed`

```json
{
  "type": "withdraw_completed",
  "title": "Withdrawal sent",
  "body": "Your withdrawal of 200.00 USD has been processed.",
  "metadata": {
    "transaction_id": "0f3b9d24-...-ff66",
    "transaction_number": "PLS-WD-202605-000045",
    "amount": 200.0,
    "currency": "USD",
    "new_balance": 1550.0
  },
  "entity_type": "transaction",
  "entity_id": "0f3b9d24-...-ff66",
  "redirect_url": "https://ployos.example/c/<businessId>/billing/transactions"
}
```

### `withdraw_reversed`

```json
{
  "type": "withdraw_reversed",
  "title": "Withdrawal reversed",
  "body": "Your withdrawal of 200.00 USD was reversed: Stripe transfer failed. The amount has been credited back.",
  "metadata": {
    "transaction_id": "0f3b9d24-...-ff66",
    "transaction_number": "PLS-WD-202605-000045",
    "amount": 200.0,
    "currency": "USD",
    "new_balance": 1750.0,
    "reason": "Stripe transfer failed"
  },
  "entity_type": "transaction",
  "entity_id": "0f3b9d24-...-ff66",
  "redirect_url": "https://ployos.example/c/<businessId>/billing/transactions",
  "actor_id": null
}
```
