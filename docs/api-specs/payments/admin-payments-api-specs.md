# AdminPaymentsController — API Specs

> **Source:** [src/modules/payments/admin/admin-payments.controller.ts](../../../src/modules/payments/admin/admin-payments.controller.ts)
> **Base path:** `/admin/payments`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@Roles(UserRole.ADMIN_PLATFORM)` + `@UseGuards(RolesGuard)`. Non-admin callers receive `403`. No `@Platform` — admins are platform-wide. The global `JwtAuthGuard` enforces auth before the role check runs.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).
> **Ownership scope:** unlike [consultant-payments](./consultant-payments-api-specs.md) and [business-payments](./business-payments-api-specs.md), these endpoints do **not** filter by the caller's profile — admins inspect every row in each ledger. Each transaction row carries an embedded `owner` block so admins can attribute it without a second call.

## Cross-cutting errors

| HTTP | error_code                 | When                                                                                                                                                            |
| ---- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`        | Missing/invalid Bearer token (global `JwtAuthGuard`).                                                                                                           |
| 403  | (forbidden, no error_code) | Caller is authenticated but not `UserRole.ADMIN_PLATFORM`.                                                                                                      |
| 422  | (validation)               | DTO shape failures from `class-validator` — invalid enum value, non-UUID `consultant_id` / `business_id`, malformed ISO dates, `limit` outside `[1, 100]`, etc. |

---

## Endpoints

### 1. List consultant transactions across all consultants

- **Endpoint:** `GET /admin/payments/consultant/transactions`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`AdminListConsultantTransactionsDto`](../../../src/modules/payments/dto/requests/admin-list-consultant-transactions.dto.ts) (extends `PageOptionsDto`)

  | Field           | Type                        | Required | Constraints                      | Notes                                                                                  |
  | --------------- | --------------------------- | -------- | -------------------------------- | -------------------------------------------------------------------------------------- |
  | `page`          | `number`                    | no       | min `1`, default `1`             | Page number (1-indexed).                                                               |
  | `limit`         | `number`                    | no       | min `1`, max `100`, default `20` | Results per page.                                                                      |
  | `sort_by`       | `string`                    | no       | —                                | Column name to sort by (not whitelisted — service always orders by `created_at DESC`). |
  | `order_by`      | `ASC \| DESC`               | no       | —                                | Sort direction (currently ignored; service is fixed to `DESC`).                        |
  | `type`          | `ConsultantTransactionType` | no       | valid enum value                 | Filter by transaction kind.                                                            |
  | `status`        | `TransactionStatus`         | no       | valid enum value                 | Filter by transaction status.                                                          |
  | `consultant_id` | `string`                    | no       | UUID v4                          | Restrict to a single consultant's ledger.                                              |
  | `created_from`  | `ISO 8601`                  | no       | parseable date string            | Inclusive lower bound on `created_at`. Pair with `created_to` for a closed range.      |
  | `created_to`    | `ISO 8601`                  | no       | parseable date string            | Inclusive upper bound on `created_at`. Either bound may be supplied independently.     |

  **`ConsultantTransactionType` values:** `credit_pending` · `credit_cleared` · `debit_pending` · `withdrawal` · `reversal`

  **`TransactionStatus` values:** `completed` · `pending` · `failed` · `reversed`

- **Response 200:** `PageDto<`[`IAdminConsultantTransactionResponse`](../../../src/modules/payments/dto/responses/interfaces/admin-consultant-transaction.response.interface.ts)`>`

  **Item fields:**

  | Field                | Type                        | Nullable | Notes                                                                                                                                   |
  | -------------------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
  | `id`                 | `string`                    | no       | UUID of the transaction.                                                                                                                |
  | `transaction_number` | `string`                    | no       | Human-facing number `LN[SHORT_TYPE][YYYYMMDD][N]` for support lookups.                                                                  |
  | `type`               | `ConsultantTransactionType` | no       | Transaction kind.                                                                                                                       |
  | `amount`             | `string`                    | no       | Consultant payout amount after platform fee (decimal string, e.g. `"100.00"`).                                                          |
  | `commission_rate`    | `string`                    | no       | Commission rate snapshot (e.g. `"0.0000"`). Defaults to `0` on consultant ledger today.                                                 |
  | `commission_amount`  | `string`                    | no       | Commission withheld (decimal string).                                                                                                   |
  | `total_amount`       | `string`                    | no       | Gross = `amount + commission_amount`.                                                                                                   |
  | `status`             | `TransactionStatus`         | no       | Current processing status.                                                                                                              |
  | `withdrawal_method`  | `string`                    | yes      | Destination description for withdrawals (e.g. `"stripe_connect"`); `null` for non-withdrawal types.                                     |
  | `note`               | `string`                    | yes      | Human-readable description; `null` when absent.                                                                                         |
  | `created_at`         | `ISO 8601`                  | no       | Timestamp rendered in the admin caller's session timezone (falls back to `UTC`). Offset included, e.g. `2026-04-20T19:00:00.000+07:00`. |
  | `owner`              | `Owner`                     | no       | Identifying snapshot of the consultant who owns this row — see below.                                                                   |

  **`owner`** ([`IAdminTransactionOwnerResponse`](../../../src/modules/payments/dto/responses/interfaces/admin-transaction-owner.response.interface.ts)):

  | Field     | Type     | Nullable | Notes                                           |
  | --------- | -------- | -------- | ----------------------------------------------- |
  | `id`      | `string` | no       | UUID of the `consultant_profiles` row.          |
  | `user_id` | `string` | no       | UUID of the user account behind that profile.   |
  | `name`    | `string` | no       | `consultant_profiles.full_name`.                |
  | `email`   | `string` | no       | `users.email` of the owning consultant account. |

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

---

### 2. List business transactions across all businesses

- **Endpoint:** `GET /admin/payments/business/transactions`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`AdminListBusinessTransactionsDto`](../../../src/modules/payments/dto/requests/admin-list-business-transactions.dto.ts) (extends `PageOptionsDto`)

  | Field          | Type                      | Required | Constraints                      | Notes                                                                                  |
  | -------------- | ------------------------- | -------- | -------------------------------- | -------------------------------------------------------------------------------------- |
  | `page`         | `number`                  | no       | min `1`, default `1`             | Page number (1-indexed).                                                               |
  | `limit`        | `number`                  | no       | min `1`, max `100`, default `20` | Results per page.                                                                      |
  | `sort_by`      | `string`                  | no       | —                                | Column name to sort by (not whitelisted — service always orders by `created_at DESC`). |
  | `order_by`     | `ASC \| DESC`             | no       | —                                | Sort direction (currently ignored; service is fixed to `DESC`).                        |
  | `type`         | `BusinessTransactionType` | no       | valid enum value                 | Filter by transaction kind.                                                            |
  | `status`       | `TransactionStatus`       | no       | valid enum value                 | Filter by transaction status.                                                          |
  | `business_id`  | `string`                  | no       | UUID v4                          | Restrict to a single business's ledger.                                                |
  | `created_from` | `ISO 8601`                | no       | parseable date string            | Inclusive lower bound on `created_at`. Pair with `created_to` for a closed range.      |
  | `created_to`   | `ISO 8601`                | no       | parseable date string            | Inclusive upper bound on `created_at`. Either bound may be supplied independently.     |

  **`BusinessTransactionType` values:** `top_up` · `withdraw` · `refund` · `project_published` · `task_added` · `monthly_billing`

  **`TransactionStatus` values:** `completed` · `pending` · `failed` · `reversed`

- **Response 200:** `PageDto<`[`IAdminBusinessTransactionResponse`](../../../src/modules/payments/dto/responses/interfaces/admin-business-transaction.response.interface.ts)`>`

  **Item fields:**

  | Field                | Type                      | Nullable | Notes                                                                                                                                                                                                                                              |
  | -------------------- | ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `id`                 | `string`                  | no       | UUID of the transaction.                                                                                                                                                                                                                           |
  | `transaction_number` | `string`                  | no       | Human-facing number `PLS[SHORT_TYPE][YYYYMMDD][N]` for support lookups.                                                                                                                                                                            |
  | `type`               | `BusinessTransactionType` | no       | Transaction kind.                                                                                                                                                                                                                                  |
  | `amount`             | `string`                  | no       | Base amount in USD (decimal string, e.g. `"100.00"`).                                                                                                                                                                                              |
  | `commission_rate`    | `string`                  | yes      | Commission rate snapshot (e.g. `"0.2500"`); `null` for types without commission.                                                                                                                                                                   |
  | `commission_amount`  | `string`                  | yes      | `amount × commission_rate`; `null` when rate is absent.                                                                                                                                                                                            |
  | `total_amount`       | `string`                  | no       | `amount + commission_amount` (equals `amount` when no commission).                                                                                                                                                                                 |
  | `status`             | `TransactionStatus`       | no       | Current processing status.                                                                                                                                                                                                                         |
  | `note`               | `string`                  | yes      | Human-readable description; `null` when absent.                                                                                                                                                                                                    |
  | `payer_info`         | `PayerInfo`               | yes      | Payer snapshot stored at checkout creation; `null` for internal ledger entries that never went through Polar (e.g. `project_published`, `task_added`). See the [business-payments spec §1](./business-payments-api-specs.md) for the nested shape. |
  | `created_at`         | `ISO 8601`                | no       | Timestamp rendered in the admin caller's session timezone (falls back to `UTC`). Offset included, e.g. `2026-04-20T19:00:00.000+07:00`.                                                                                                            |
  | `owner`              | `Owner`                   | no       | Identifying snapshot of the business who owns this row — see below.                                                                                                                                                                                |

  **`owner`** ([`IAdminTransactionOwnerResponse`](../../../src/modules/payments/dto/responses/interfaces/admin-transaction-owner.response.interface.ts)):

  | Field     | Type     | Nullable | Notes                                         |
  | --------- | -------- | -------- | --------------------------------------------- |
  | `id`      | `string` | no       | UUID of the `business_profiles` row.          |
  | `user_id` | `string` | no       | UUID of the user account behind that profile. |
  | `name`    | `string` | no       | `business_profiles.company_name`.             |
  | `email`   | `string` | no       | `users.email` of the owning business account. |

  **Pagination meta:** identical shape to §1.

- **Errors:** cross-cutting only.
