# ConsultantPaymentsController — API Specs

> **Source:** [src/modules/payments/consultant/consultant-payments.controller.ts](../../../src/modules/payments/consultant/consultant-payments.controller.ts)
> **Base path:** `/payments/consultant`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).

## Cross-cutting errors (apply to all endpoints unless stated otherwise)

| HTTP | error_code                     | When                                                                                                                                                                                                   |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token.                                                                                                                                                                          |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller's `activePlatform` is not `CONSULTANT` or no active consultant profile exists — thrown by [ConsultantPaymentsService](../../../src/modules/payments/consultant/consultant-payments.service.ts). |
| 422  | (validation)                   | DTO shape failures from `class-validator` (invalid fields, enum, range).                                                                                                                               |

---

## Endpoints

### 1. List own transactions

- **Endpoint:** `GET /payments/consultant/transactions`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`ListConsultantTransactionsDto`](../../../src/modules/payments/dto/requests/list-consultant-transactions.dto.ts) (extends `PageOptionsDto`)

  | Field      | Type                        | Required | Constraints                      | Notes                                                   |
  | ---------- | --------------------------- | -------- | -------------------------------- | ------------------------------------------------------- |
  | `page`     | `number`                    | no       | min `1`, default `1`             | Page number (1-indexed).                                |
  | `limit`    | `number`                    | no       | min `1`, max `100`, default `20` | Results per page.                                       |
  | `sort_by`  | `string`                    | no       | —                                | Column name to sort by (defaults to `created_at DESC`). |
  | `order_by` | `ASC \| DESC`               | no       | —                                | Sort direction.                                         |
  | `type`     | `ConsultantTransactionType` | no       | valid enum value                 | Filter by transaction kind.                             |
  | `status`   | `TransactionStatus`         | no       | valid enum value                 | Filter by transaction status.                           |

  **`ConsultantTransactionType` values:** `credit_pending` · `credit_cleared` · `debit_pending` · `withdrawal` · `reversal`

  **`TransactionStatus` values:** `completed` · `pending` · `failed` · `reversed`

- **Response 200:** `PageDto<`[`IConsultantTransactionResponse`](../../../src/modules/payments/dto/responses/interfaces/consultant-transaction.response.interface.ts)`>`

  **Item fields:**

  | Field               | Type                        | Nullable | Notes                                                                                               |
  | ------------------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
  | `id`                | `string`                    | no       | UUID of the transaction.                                                                            |
  | `type`              | `ConsultantTransactionType` | no       | Transaction kind.                                                                                   |
  | `amount`            | `string`                    | no       | Amount in platform currency (decimal string, e.g. `"100.00"`).                                      |
  | `status`            | `TransactionStatus`         | no       | Current processing status.                                                                          |
  | `withdrawal_method` | `string`                    | yes      | Destination description for withdrawals (e.g. `"stripe_connect"`); `null` for non-withdrawal types. |
  | `note`              | `string`                    | yes      | Human-readable description; `null` when absent.                                                     |
  | `created_at`        | `ISO 8601`                  | no       | Timestamp of transaction creation.                                                                  |

  **Pagination meta:**

  | Field               | Type      | Notes                |
  | ------------------- | --------- | -------------------- |
  | `page`              | `number`  | Current page number. |
  | `limit`             | `number`  | Page size used.      |
  | `item_count`        | `number`  | Total matching rows. |
  | `page_count`        | `number`  | Total pages.         |
  | `has_previous_page` | `boolean` | —                    |
  | `has_next_page`     | `boolean` | —                    |

- **Errors:** cross-cutting only.
