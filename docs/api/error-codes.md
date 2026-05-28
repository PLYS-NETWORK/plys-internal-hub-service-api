# Error Codes Catalog

Stable `errorCode` values are owned per service in `apps/<service>/src/errors/error-codes.ts`. Shared infrastructure codes (generic HTTP, database, auth guards, file storage) live in `packages/common-nest/constants/`.

Every HTTP error response includes `errorCode` in the [StandardizedResponse](./common-response.md) envelope. **Frontends must branch on `errorCode`, not on `message`** (messages are localized).

---

## How HTTP status is chosen

| Source                                | Rule                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `TranslatableException`               | Uses `status` from the throw site; if omitted, defaults to **400 Bad Request** |
| Nest `HttpException` (no `errorCode`) | `GlobalExceptionFilter` maps status → generic `GENERIC_*` code (see below)     |
| PostgreSQL `QueryFailedError`         | `mapPostgresError()` → fixed status + `DATABASE_*` or domain code              |
| Uncaught errors                       | **500** + `GENERIC_INTERNAL_SERVER_ERROR`                                      |

### Generic HTTP → `errorCode` fallback

When an `HttpException` has no explicit `errorCode`:

| HTTP | `errorCode`                     |
| ---- | ------------------------------- |
| 400  | `GENERIC_BAD_REQUEST`           |
| 401  | `GENERIC_UNAUTHORIZED`          |
| 403  | `GENERIC_FORBIDDEN`             |
| 404  | `GENERIC_NOT_FOUND`             |
| 409  | `GENERIC_CONFLICT`              |
| 422  | `GENERIC_UNPROCESSABLE`         |
| 500+ | `GENERIC_INTERNAL_SERVER_ERROR` |

### PostgreSQL driver codes

| PG code                          | HTTP | `errorCode`                         |
| -------------------------------- | ---- | ----------------------------------- |
| `23505` unique violation         | 409  | `DATABASE_UNIQUE_VIOLATION`         |
| `23503` foreign key              | 422  | `DATABASE_FOREIGN_KEY_VIOLATION`    |
| `23502` not null                 | 422  | `DATABASE_NOT_NULL_VIOLATION`       |
| `P0001` (trigger) project status | 422  | `PROJECT_INVALID_STATUS_TRANSITION` |
| `P0001` (other)                  | 422  | `GENERIC_BAD_REQUEST`               |

---

## `generic.ts`

| `errorCode`                     | Typical HTTP | Notes                                                 |
| ------------------------------- | ------------ | ----------------------------------------------------- |
| `GENERIC_BAD_REQUEST`           | 400          | Default for unscoped client errors                    |
| `GENERIC_UNAUTHORIZED`          | 401          | Missing/invalid auth                                  |
| `GENERIC_FORBIDDEN`             | 403          | Authenticated but not allowed (incl. `PlatformGuard`) |
| `GENERIC_NOT_FOUND`             | 404          | Generic resource missing                              |
| `GENERIC_CONFLICT`              | 409          | Generic state conflict                                |
| `GENERIC_UNPROCESSABLE`         | 422          | Semantic validation failure                           |
| `GENERIC_INTERNAL_SERVER_ERROR` | 500          | Unhandled server error                                |
| `GENERIC_VALIDATION_FAILED`     | 400          | DTO / input validation                                |
| `EMAIL_DELIVERY_FAILED`         | 500 / 502    | Email provider failure                                |
| `WS_CONNECT_RATE_LIMITED`       | —            | WebSocket only; not HTTP envelope                     |
| `WS_MAX_CONNECTIONS_EXCEEDED`   | —            | WebSocket only; not HTTP envelope                     |

### `DATABASE_ERROR_CODES` (same file)

| `errorCode`                      | HTTP |
| -------------------------------- | ---- |
| `DATABASE_UNIQUE_VIOLATION`      | 409  |
| `DATABASE_FOREIGN_KEY_VIOLATION` | 422  |
| `DATABASE_NOT_NULL_VIOLATION`    | 422  |

---

## `identity.ts`

| `errorCode`                              | Typical HTTP |
| ---------------------------------------- | ------------ |
| `AUTH_INVALID_CREDENTIALS`               | 401          |
| `AUTH_TOKEN_EXPIRED`                     | 401          |
| `AUTH_TOKEN_INVALID`                     | 401          |
| `AUTH_TOKEN_ALREADY_USED`                | 400          |
| `AUTH_DEVICE_MISMATCH`                   | 401          |
| `AUTH_EMAIL_NOT_VERIFIED`                | 403          |
| `AUTH_EMAIL_ALREADY_REGISTERED`          | 409          |
| `AUTH_EMAIL_PENDING_VERIFICATION`        | 409          |
| `AUTH_USER_NOT_FOUND`                    | 404          |
| `AUTH_ACCOUNT_INACTIVE`                  | 403          |
| `AUTH_ACCOUNT_LOCKED`                    | 429          |
| `AUTH_RESET_TOKEN_INVALID`               | 400          |
| `AUTH_RESET_TOKEN_EXPIRED`               | 400          |
| `AUTH_OAUTH_STATE_INVALID`               | 400          |
| `AUTH_RATE_LIMITED`                      | 429          |
| `AUTH_SSO_EXCHANGE_INVALID`              | 401          |
| `ADMIN_AUTH_OTP_INVALID`                 | 401          |
| `ADMIN_AUTH_OTP_LOCKED`                  | 429          |
| `ADMIN_AUTH_RESEND_LIMIT`                | 429          |
| `ADMIN_AUTH_EMAIL_NOT_ALLOWED`           | 403          |
| `ADMIN_ALLOWED_EMAIL_ALREADY_EXISTS`     | 409          |
| `ADMIN_ALLOWED_EMAIL_REVOKED`            | 403          |
| `ADMIN_ALLOWED_EMAIL_NOT_FOUND`          | 404          |
| `ADMIN_ALLOWED_EMAIL_CANNOT_REVOKE_SELF` | 403          |

---

## `profiles.ts`

| `errorCode`                                 | Typical HTTP |
| ------------------------------------------- | ------------ |
| `BUSINESS_PROFILE_ALREADY_EXISTS`           | 409          |
| `BUSINESS_PROFILE_NOT_FOUND`                | 404          |
| `BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS`    | 409          |
| `CONSULTANT_PROFILE_ALREADY_EXISTS`         | 409          |
| `CONSULTANT_PROFILE_NOT_FOUND`              | 404          |
| `CONSULTANT_ONBOARDING_NOT_FOUND`           | 404          |
| `CONSULTANT_ONBOARDING_BLOCKED`             | 403          |
| `CONSULTANT_ONBOARDING_INVALID_STATUS`      | 409          |
| `CONSULTANT_ONBOARDING_INCOMPLETE_ANSWERS`  | 422          |
| `CONSULTANT_ONBOARDING_NOT_APPROVED`        | 403          |
| `CONSULTANT_ONBOARDING_INVALID_ANSWER`      | 422          |
| `CONSULTANT_ONBOARDING_ANSWERS_COVERAGE`    | 422          |
| `ONBOARDING_QUESTION_NOT_FOUND`             | 404          |
| `ONBOARDING_QUESTION_INVALID_OPTIONS`       | 422          |
| `ONBOARDING_QUESTION_TYPE_CHANGE_FORBIDDEN` | 422          |
| `ONBOARDING_REORDER_SET_MISMATCH`           | 422          |
| `SKILL_EXAM_NOT_FOUND`                      | 404          |
| `SKILL_EXAM_USER_BANNED`                    | 403          |
| `SKILL_EXAM_ALREADY_PASSED`                 | 409          |
| `SKILL_EXAM_ALREADY_IN_PROGRESS`            | 409          |
| `SKILL_EXAM_COOLDOWN_ACTIVE`                | 409          |
| `SKILL_EXAM_PARALLEL_LIMIT_REACHED`         | 409          |
| `SKILL_EXAM_INVALID_STATUS`                 | 409          |
| `SKILL_EXAM_INCOMPLETE_ANSWERS`             | 422          |
| `SKILL_EXAM_NOT_READY`                      | 422          |
| `SKILL_EXAM_EXPIRED`                        | 409          |
| `SKILL_EXAM_TAKING_BLOCKED`                 | 403          |

---

## `projects.ts`

| `errorCode`                                   | Typical HTTP |
| --------------------------------------------- | ------------ |
| `PROJECT_NOT_FOUND`                           | 404          |
| `PROJECT_FORBIDDEN`                           | 403          |
| `PROJECT_INVALID_STATUS_TRANSITION`           | 422          |
| `PROJECT_REQUIRES_TASKS_FOR_CONFIGURED`       | 422          |
| `PROJECT_SKILL_NOT_FOUND`                     | 404          |
| `PROJECT_CANNOT_BE_EDITED`                    | 422          |
| `PROJECT_CANNOT_PUBLISH`                      | 422          |
| `PROJECT_INSUFFICIENT_BALANCE`                | 422          |
| `PROJECT_INVALID_TASK_PRICE`                  | 422          |
| `PROJECT_RECALL_TRANSACTION_NOT_FOUND`        | 404          |
| `PROJECT_CANNOT_BE_DELETED`                   | 422          |
| `PROJECT_CODE_ALREADY_EXISTS`                 | 409          |
| `PROJECT_MINIMUM_TASKS_NOT_MET`               | 422          |
| `PROJECT_MINIMUM_COST_NOT_MET`                | 422          |
| `PROJECT_ALREADY_MEMBER`                      | 409          |
| `PROJECT_MEMBERSHIP_BANNED`                   | 403          |
| `PROJECT_FULL`                                | 409          |
| `PROJECT_NOT_JOINABLE`                        | 422          |
| `PROJECT_SKILL_MATCH_INSUFFICIENT`            | 422          |
| `PROJECT_CONCURRENT_LIMIT_REACHED`            | 409          |
| `PROJECT_NOT_MEMBER`                          | 403          |
| `PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS`       | 422          |
| `TASK_NOT_FOUND`                              | 404          |
| `TASK_INVALID_STATUS_TRANSITION`              | 422          |
| `TASK_ALREADY_ASSIGNED`                       | 409          |
| `TASK_PROJECT_NOT_IN_PROGRESS`                | 422          |
| `TASK_RESULT_NOT_FOUND`                       | 404          |
| `TASK_RESULT_FORBIDDEN`                       | 403          |
| `TASK_RESULT_NOT_ASSIGNEE`                    | 403          |
| `TASK_RESULT_FILE_NOT_OWNED`                  | 403          |
| `TASK_RESULT_EMPTY_UPDATE`                    | 422          |
| `TASK_CONSULTANT_ALREADY_IN_PROGRESS`         | 409          |
| `TASK_ATTACHMENT_NOT_FOUND`                   | 404          |
| `TASK_ATTACHMENT_FORBIDDEN`                   | 403          |
| `TASK_ATTACHMENT_FILE_NOT_OWNED`              | 403          |
| `TASK_ATTACHMENT_INVALID_STATUS`              | 422          |
| `TASK_NOT_CLAIMABLE`                          | 422          |
| `TASK_NOT_OWNED_BY_CONSULTANT`                | 403          |
| `TASK_INVALID_STATE_FOR_UNASSIGN`             | 422          |
| `TASK_INVALID_STATE_FOR_SUBMIT`               | 422          |
| `TASK_DUE_DATE_INVALID`                       | 422          |
| `TASK_REVIEW_NOT_FOUND`                       | 404          |
| `TASK_REVIEW_FORBIDDEN`                       | 403          |
| `TASK_REVIEW_ALREADY_VOTED`                   | 409          |
| `TASK_REVIEW_ROUND_CLOSED`                    | 409          |
| `TASK_REVIEW_INVALID_DECISION`                | 422          |
| `TASK_REVIEW_INSUFFICIENT_REVIEWERS`          | 503          |
| `AI_PROVIDER_KEY_NOT_CONFIGURED`              | 422          |
| `AI_PROVIDER_KEY_NOT_FOUND`                   | 404          |
| `AI_PROVIDER_KEY_ACTIVE_REQUIRES_REPLACEMENT` | 422          |
| `AI_PROVIDER_KEY_CIPHER_FAILED`               | 500          |
| `CHAT_SESSION_NOT_FOUND`                      | 404          |
| `CHAT_SESSION_NOT_ACTIVE`                     | 409          |
| `CHAT_SESSION_MODE_NOT_ALLOWED`               | 422          |
| `CHAT_SESSION_MESSAGE_LIMIT_EXCEEDED`         | 413          |
| `AI_CONTEXT_NOT_FOUND`                        | 404          |
| `AI_CONTEXT_DERIVED_HTML_FORBIDDEN`           | 422          |
| `IDEMPOTENCY_KEY_BODY_MISMATCH`               | 409          |
| `AI_SYNC_TASK_REJECTED`                       | 422          |
| `AI_SYNC_SKILL_NOT_FOUND`                     | 404          |
| `PROJECT_PRICE_GATE_FAILED`                   | 422          |

---

## `finance.ts`

| `errorCode`                       | Typical HTTP |
| --------------------------------- | ------------ |
| `PAYMENT_INSUFFICIENT_BALANCE`    | 422          |
| `PAYMENT_STRIPE_NOT_CONNECTED`    | 422          |
| `PAYMENT_TRANSFER_FAILED`         | 500          |
| `PAYMENT_CHECKOUT_FAILED`         | 500          |
| `PAYMENT_MINIMUM_WITHDRAWAL`      | 422          |
| `PAYMENT_TRANSACTION_NOT_FOUND`   | 404          |
| `PAYMENT_TRANSACTION_NOT_OWNED`   | 403          |
| `PAYMENT_TRANSACTION_NOT_PENDING` | 409          |
| `BILLING_PERIOD_NOT_FOUND`        | 404          |
| `BILLING_INVOICE_NOT_FOUND`       | 404          |
| `BILLING_INVOICE_ALREADY_PAID`    | 409          |
| `BILLING_INVOICE_NOT_OWNED`       | 403          |
| `BILLING_CHECKOUT_FAILED`         | 500          |

---

## `platform.ts`

| `errorCode`                | Typical HTTP |
| -------------------------- | ------------ |
| `FILE_NOT_FOUND`           | 404          |
| `FILE_UPLOAD_FAILED`       | 500          |
| `FILE_INVALID_TYPE`        | 415          |
| `FILE_SIZE_EXCEEDED`       | 413          |
| `FILE_STORAGE_ERROR`       | 500          |
| `FILE_DELETE_FAILED`       | 500          |
| `FILE_QUOTA_EXCEEDED`      | 413          |
| `FILE_FORBIDDEN`           | 403          |
| `FILE_DIMENSIONS_EXCEEDED` | 422          |
| `NOTIFICATION_NOT_FOUND`   | 404          |
| `NOTIFICATION_FORBIDDEN`   | 403          |

---

## Notes for frontend engineers

1. **Default HTTP is 400** when a service throws `TranslatableException` without `status`. If UX depends on status (e.g. 404 page), prefer checking **`errorCode`** ends with `_NOT_FOUND` or equals a known code.
2. **`data` on errors** may carry structured fields (`offending_task_ids`, etc.) — see endpoint specs.
3. **Idempotency**: `IDEMPOTENCY_KEY_BODY_MISMATCH` → 409; retry with a new key or the same body.
4. **Rate limits**: auth lockout and admin OTP use **429**; HTTP throttling may return Nest throttle responses mapped to generic codes.
5. Source of truth for new codes: add to the owning service's `src/errors/error-codes.ts`. Use `packages/shared-kernel/errors/generic.ts` only for cross-cutting `GENERIC_*` and `DATABASE_*` codes.

---

## Related docs

| Document                                   | Topic                         |
| ------------------------------------------ | ----------------------------- |
| [common-response.md](./common-response.md) | Success/error envelope fields |
| [api-specs/](../api-specs/)                | Per-endpoint error behavior   |
