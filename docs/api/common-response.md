# Standardized HTTP Response Envelope

All **api-gateway** REST responses use a single JSON envelope: `StandardizedResponse<T>` (`packages/common-nest/response/standardized-response.ts`). Frontends should parse this shape for every HTTP status code (2xx and 4xx/5xx).

Success and error responses share the **same top-level fields**. The HTTP status code on the wire (e.g. `404`) matches `statusCode` in the body.

---

## Success envelope (2xx)

Produced by `TransformResponseInterceptor` after a controller returns either:

- `{ messageKey, data }` — translated success message, or
- a raw `data` value — message falls back to `success.ok`.

### Shape

| Field        | Type             | Success value            | Description                                                   |
| ------------ | ---------------- | ------------------------ | ------------------------------------------------------------- |
| `statusCode` | `number`         | HTTP status (e.g. `200`) | Same as response HTTP status                                  |
| `message`    | `string`         | Localized text           | Resolved from `messageKey` via `nestjs-i18n` (`success.json`) |
| `errorCode`  | `string \| null` | `null`                   | Always `null` on success                                      |
| `data`       | `T \| null`      | Payload                  | Controller return value                                       |
| `timestamp`  | `string`         | ISO-8601                 | Server time when the response was built                       |
| `path`       | `string`         | Request URL              | e.g. `/api/v1/business/projects`                              |
| `request_id` | `string`         | Correlation id           | From `RequestContextService` (tracing / support)              |
| `device_id`  | `string \| null` | Client device            | From `x-device-id` header when present                        |

### Example

```json
{
  "statusCode": 200,
  "message": "Project created successfully.",
  "errorCode": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "PRJ-001"
  },
  "timestamp": "2026-05-29T12:00:00.000Z",
  "path": "/api/v1/business/projects",
  "request_id": "reqId-550e8400-e29b-41d4-a716-446655440000",
  "device_id": "device-abc"
}
```

### Frontend guidance

- Branch on **`data`** for success payloads; do not rely on `message` for machine logic (it is localized).
- Send **`x-device-id`** on authenticated calls if the product tracks devices; it is echoed in `device_id`.
- Log or attach **`request_id`** when reporting bugs to support.

---

## Error envelope (4xx / 5xx)

Produced by `GlobalExceptionFilter` for `TranslatableException`, Nest `HttpException`, TypeORM `QueryFailedError`, and uncaught errors.

### Shape

Same fields as success, with these differences:

| Field        | Type             | Error value      | Description                                                                          |
| ------------ | ---------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `statusCode` | `number`         | HTTP status      | e.g. `404`, `409`                                                                    |
| `message`    | `string`         | Localized text   | Resolved from exception `messageKey` (`error.*` in i18n)                             |
| `errorCode`  | `string`         | Stable code      | Machine-readable; see [error-codes.md](./error-codes.md)                             |
| `data`       | `object \| null` | Optional details | Structured context for some 4xx errors (e.g. `offending_task_ids`); otherwise `null` |

### Example — not found

```json
{
  "statusCode": 404,
  "message": "Project not found.",
  "errorCode": "PROJECT_NOT_FOUND",
  "data": null,
  "timestamp": "2026-05-29T12:00:01.000Z",
  "path": "/api/v1/business/projects/550e8400-e29b-41d4-a716-446655440000",
  "request_id": "reqId-7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "device_id": null
}
```

### Example — validation with details

Some errors set `details` on `TranslatableException`; the filter exposes them as **`data`** so clients do not parse the human-readable `message`.

```json
{
  "statusCode": 422,
  "message": "Task prices failed the project price gate.",
  "errorCode": "PROJECT_PRICE_GATE_FAILED",
  "data": {
    "offending_task_ids": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"]
  },
  "timestamp": "2026-05-29T12:00:02.000Z",
  "path": "/api/v1/business/projects/550e8400-e29b-41d4-a716-446655440000/publish",
  "request_id": "reqId-8d4e3c2b-1a0f-9e8d-7c6b-5a4f3e2d1c0b",
  "device_id": "device-abc"
}
```

### Frontend guidance

- **Always branch on `errorCode`**, not `message` (translations change by locale).
- Treat **`statusCode`** as the HTTP semantic; use **`errorCode`** for product-specific UX (retry, redirect, form hints).
- When **`data`** is non-null, parse it as typed metadata documented per endpoint in [api-specs/](../api-specs/).
- On **401**, refresh token or re-login; on **403**, check platform/role; on **409**, show conflict UI or refresh state.

---

## Validation errors (class-validator)

`I18nValidationPipe` + `I18nValidationExceptionFilter` run **before** `GlobalExceptionFilter` for DTO validation failures. Those responses may use Nest’s default validation shape on some code paths; gateway controllers should prefer `TranslatableException` with `GENERIC_VALIDATION_FAILED` where unified envelope is required.

When the global filter handles a generic `HttpException` from validation, unmapped statuses fall back to:

| HTTP status | `errorCode`                     |
| ----------- | ------------------------------- |
| 400         | `GENERIC_BAD_REQUEST`           |
| 401         | `GENERIC_UNAUTHORIZED`          |
| 403         | `GENERIC_FORBIDDEN`             |
| 404         | `GENERIC_NOT_FOUND`             |
| 409         | `GENERIC_CONFLICT`              |
| 422         | `GENERIC_UNPROCESSABLE`         |
| other       | `GENERIC_INTERNAL_SERVER_ERROR` |

---

## WebSocket errors (notifications)

Realtime notification connections use Socket.IO on api-gateway (`/ws/notifications`). Connection errors emit a small event payload **`{ code: "<ERROR_CODE>" }`**, not the HTTP envelope.

| Code                          | Meaning                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `WS_CONNECT_RATE_LIMITED`     | Too many handshake attempts from this IP                  |
| `WS_MAX_CONNECTIONS_EXCEEDED` | User exceeded max concurrent sockets (oldest tab evicted) |

See [notifications-realtime-api-specs.md](../api-specs/notifications-service/notifications-realtime-api-specs.md).

---

## Related docs

| Document                           | Topic                                     |
| ---------------------------------- | ----------------------------------------- |
| [error-codes.md](./error-codes.md) | Full `errorCode` catalog and HTTP mapping |
| [api-specs/](../api-specs/)        | Per-route request/response contracts      |
