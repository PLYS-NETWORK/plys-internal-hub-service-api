# BusinessPaymentsController — API Specs

> **Source:** [src/modules/payments/business/business-payments.controller.ts](../../../../src/modules/payments/business/business-payments.controller.ts)
> **Base path:** `/payments/business`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).

## Cross-cutting errors (apply to all endpoints unless stated otherwise)

| HTTP | error_code                   | When                                                                                                                                                                                                         |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token.                                                                                                                                                                                |
| 403  | `BUSINESS_PROFILE_NOT_FOUND` | Caller's `activePlatform` is not `BUSINESS` or no active business profile exists for the user — thrown by [BusinessPaymentsService](../../../../src/modules/payments/business/business-payments.service.ts). |
| 422  | (validation)                 | DTO shape failures from `class-validator` (missing/invalid fields, UUID, URL, enum).                                                                                                                         |

---

## Endpoints

### 1. Initiate account top-up

- **Endpoint:** `POST /payments/business/top-up`
- **Method:** `POST`
- **Status:** `201 Created`
- **Request body:** [`ICreateTopUpRequest`](../../../../src/modules/payments/dto/requests/interfaces/create-top-up.request.interface.ts)

  | Field         | Type        | Required | Constraints                      | Notes                                                       |
  | ------------- | ----------- | -------- | -------------------------------- | ----------------------------------------------------------- |
  | `amount`      | `number`    | yes      | min `10`, max 2 decimal places   | Amount in USD to top up.                                    |
  | `success_url` | `string`    | yes      | valid URL (`require_tld: false`) | Redirect URL after successful Polar checkout.               |
  | `cancel_url`  | `string`    | yes      | valid URL (`require_tld: false`) | Redirect URL if the checkout is abandoned or payment fails. |
  | `payer_info`  | `PayerInfo` | yes      | nested object — see below        | Payer name, email, and billing address.                     |

  **`payer_info`** ([`IPayerInfoRequest`](../../../../src/modules/payments/dto/requests/interfaces/payer-info.request.interface.ts)):

  | Field             | Type             | Required | Constraints               | Notes                                       |
  | ----------------- | ---------------- | -------- | ------------------------- | ------------------------------------------- |
  | `name`            | `string`         | yes      | 1–255 chars               | Contact/payer name (matches Polar profile). |
  | `email`           | `string`         | yes      | valid email               | Contact email.                              |
  | `billing_address` | `BillingAddress` | yes      | nested object — see below | Full billing address.                       |

  **`billing_address`** ([`IBillingAddressRequest`](../../../../src/modules/payments/dto/requests/interfaces/billing-address.request.interface.ts)):

  | Field         | Type     | Required | Constraints        | Notes                                |
  | ------------- | -------- | -------- | ------------------ | ------------------------------------ |
  | `line1`       | `string` | yes      | 1–255 chars        | Street address.                      |
  | `line2`       | `string` | no       | ≤255 chars         | Apartment / suite (optional).        |
  | `city`        | `string` | yes      | 1–100 chars        | City.                                |
  | `state`       | `string` | no       | ≤100 chars         | State / province (optional).         |
  | `postal_code` | `string` | yes      | 1–20 chars         | Postal / ZIP code.                   |
  | `country`     | `string` | yes      | ISO 3166-1 alpha-2 | Two-letter country code (uppercase). |

  No card or PCI data is collected here — that stays on Polar's hosted page.

- **Behaviour:**
  1. Creates a `TOP_UP` `BusinessTransaction` with `status = PENDING` (transaction number generated atomically). The supplied `payer_info` is snapshotted onto the transaction row.
  2. Calls Polar `createCheckoutSession` with the payer info — Polar's hosted page is pre-filled (name, email, billing address). Saves the `processorInvoiceId` on the transaction row.
  3. Returns the checkout redirect URL for the frontend to navigate the user to.
  4. On checkout success, the Polar webhook handler transitions the transaction to `COMPLETED` and credits `accountBalance` — **this response does not confirm payment**. If the user edited `billing_address` on the hosted page, the webhook merges the corrected values onto the stored `payer_info` (name/email kept from the original request — Polar does not return them).
  5. If the Polar API call fails, the transaction is marked `FAILED` and `PAYMENT_CHECKOUT_FAILED` is thrown.

- **Response 201:** [`ITopUpResponse`](../../../../src/modules/payments/dto/responses/interfaces/top-up.response.interface.ts)

  | Field            | Type     | Notes                                                                  |
  | ---------------- | -------- | ---------------------------------------------------------------------- |
  | `transaction_id` | `string` | UUID of the created `TOP_UP` transaction.                              |
  | `redirect_url`   | `string` | Polar-hosted checkout URL. Redirect the user here to complete payment. |

- **Errors:**

  | HTTP | error_code                | When                                                                    |
  | ---- | ------------------------- | ----------------------------------------------------------------------- |
  | 500  | `PAYMENT_CHECKOUT_FAILED` | Polar checkout session creation failed. Transaction is marked `FAILED`. |

---

### 2. Resume a pending top-up

- **Endpoint:** `POST /payments/business/top-up/:transaction_id/continue`
- **Method:** `POST`
- **Status:** `200 OK`
- **Path params:** `transaction_id` (UUID v4)

- **Purpose:** Called when the user closed the Polar checkout tab and wants to return to the same session — avoids creating a duplicate transaction.

- **Pre-condition:** the transaction must be owned by the caller, `type = TOP_UP`, and `status = PENDING`.

- **Behaviour:** Re-fetches the existing Polar checkout session via `processorEventId` and returns the same redirect URL. No new transaction or checkout session is created.

- **Response 200:** [`ITopUpResponse`](../../../../src/modules/payments/dto/responses/interfaces/top-up.response.interface.ts)

  | Field            | Type     | Notes                                     |
  | ---------------- | -------- | ----------------------------------------- |
  | `transaction_id` | `string` | UUID of the existing pending transaction. |
  | `redirect_url`   | `string` | Re-fetched Polar checkout URL.            |

- **Errors:**

  | HTTP | error_code                        | When                                                                          |
  | ---- | --------------------------------- | ----------------------------------------------------------------------------- |
  | 404  | `PAYMENT_TRANSACTION_NOT_FOUND`   | No transaction with the given UUID.                                           |
  | 403  | `PAYMENT_TRANSACTION_NOT_OWNED`   | Transaction belongs to a different business.                                  |
  | 409  | `PAYMENT_TRANSACTION_NOT_PENDING` | Transaction `status ≠ PENDING` or `type ≠ TOP_UP`.                            |
  | 500  | `PAYMENT_CHECKOUT_FAILED`         | Transaction has no `processorEventId` — checkout session cannot be retrieved. |

---

### 3. Cancel a pending top-up

- **Endpoint:** `POST /payments/business/top-up/:transaction_id/cancel`
- **Method:** `POST`
- **Status:** `200 OK`
- **Path params:** `transaction_id` (UUID v4)

- **Pre-condition:** the transaction must be owned by the caller, `type = TOP_UP`, and `status = PENDING`.

- **Behaviour:**
  1. Attempts **best-effort** provider-side cancellation via `cancelCheckoutSession`. Polar does not support programmatic cancellation (`NotImplementedException`) — this is tolerated and local cleanup always proceeds regardless of the provider response.
  2. Sets `status = FAILED`, `note = 'Cancelled by user'`.
  3. Post-save: sends a top-up cancellation email (fire-and-forget; failure does not fail the response).
  4. **No balance adjustment** — a top-up in PENDING status means the checkout was never completed; no charge was made to the user's payment method.

- **Response 200:** [`ICancelTopUpResponse`](../../../../src/modules/payments/dto/responses/interfaces/cancel-top-up.response.interface.ts)

  | Field            | Type                | Notes                              |
  | ---------------- | ------------------- | ---------------------------------- |
  | `transaction_id` | `string`            | UUID of the cancelled transaction. |
  | `status`         | `TransactionStatus` | Always `failed`.                   |

- **Errors:**

  | HTTP | error_code                        | When                                               |
  | ---- | --------------------------------- | -------------------------------------------------- |
  | 404  | `PAYMENT_TRANSACTION_NOT_FOUND`   | No transaction with the given UUID.                |
  | 403  | `PAYMENT_TRANSACTION_NOT_OWNED`   | Transaction belongs to a different business.       |
  | 409  | `PAYMENT_TRANSACTION_NOT_PENDING` | Transaction `status ≠ PENDING` or `type ≠ TOP_UP`. |

---

### 4. Settle a billing invoice

- **Endpoint:** `POST /payments/business/settle-invoice`
- **Method:** `POST`
- **Status:** `201 Created`
- **Request body:** [`ISettleInvoiceRequest`](../../../../src/modules/payments/dto/requests/interfaces/settle-invoice.request.interface.ts)

  | Field         | Type        | Required | Constraints              | Notes                                   |
  | ------------- | ----------- | -------- | ------------------------ | --------------------------------------- |
  | `invoice_id`  | `string`    | yes      | UUID v4                  | ID of the outstanding invoice to pay.   |
  | `success_url` | `string`    | yes      | valid URL (TLD required) | Redirect URL after successful payment.  |
  | `cancel_url`  | `string`    | yes      | valid URL (TLD required) | Redirect URL if checkout is abandoned.  |
  | `payer_info`  | `PayerInfo` | yes      | see §1 for nested shape  | Payer name, email, and billing address. |

  See §1 for the `payer_info` / `billing_address` sub-tables — the same shape applies here.

- **Behaviour:**
  1. Verifies the invoice exists, is owned by the calling business, and is **not already paid**.
  2. Looks up the linked `MONTHLY_BILLING` `BusinessTransaction` for the invoice.
  3. Calls Polar `createCheckoutSession` with the supplied `payer_info` so the hosted page is pre-filled. Saves processor IDs on both the invoice and the transaction row, and snapshots the payer info onto the `MONTHLY_BILLING` transaction.
  4. The webhook handler marks the invoice `PAID` and the transaction `COMPLETED` asynchronously after the user completes payment. If the user edited `billing_address` on the hosted page, the webhook merges the corrected values onto the stored `payer_info`.

- **Response 201:** [`ISettleInvoiceResponse`](../../../../src/modules/payments/dto/responses/interfaces/settle-invoice.response.interface.ts)

  | Field          | Type     | Notes                                              |
  | -------------- | -------- | -------------------------------------------------- |
  | `invoice_id`   | `string` | UUID of the invoice being settled.                 |
  | `redirect_url` | `string` | Polar-hosted checkout URL for the invoice payment. |

- **Errors:**

  | HTTP | error_code                     | When                                                                              |
  | ---- | ------------------------------ | --------------------------------------------------------------------------------- |
  | 404  | `BILLING_INVOICE_NOT_FOUND`    | No invoice with the given UUID, or no linked `MONTHLY_BILLING` transaction found. |
  | 403  | `BILLING_INVOICE_NOT_OWNED`    | Invoice belongs to a different business.                                          |
  | 409  | `BILLING_INVOICE_ALREADY_PAID` | Invoice `status = PAID`; cannot re-settle.                                        |
  | 500  | `BILLING_CHECKOUT_FAILED`      | Polar checkout session creation failed.                                           |

---

### 5. List own transactions

- **Endpoint:** `GET /payments/business/transactions`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`ListBusinessTransactionsDto`](../../../../src/modules/payments/dto/requests/list-business-transactions.dto.ts) (extends `PageOptionsDto`)

  | Field      | Type                      | Required | Constraints                      | Notes                                                                                    |
  | ---------- | ------------------------- | -------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
  | `page`     | `number`                  | no       | min `1`, default `1`             | Page number (1-indexed).                                                                 |
  | `limit`    | `number`                  | no       | min `1`, max `100`, default `20` | Results per page.                                                                        |
  | `sort_by`  | `string`                  | no       | —                                | Column name to sort by (not whitelisted — defaults to `created_at DESC` in the service). |
  | `order_by` | `ASC \| DESC`             | no       | —                                | Sort direction.                                                                          |
  | `type`     | `BusinessTransactionType` | no       | valid enum value                 | Filter by transaction kind.                                                              |
  | `status`   | `TransactionStatus`       | no       | valid enum value                 | Filter by transaction status.                                                            |

  **`BusinessTransactionType` values:** `top_up` · `withdraw` · `refund` · `project_published` · `task_added` · `monthly_billing`

  **`TransactionStatus` values:** `completed` · `pending` · `failed` · `reversed`

- **Response 200:** `PageDto<`[`ITransactionResponse`](../../../../src/modules/payments/dto/responses/interfaces/transaction.response.interface.ts)`>`

  **Item fields:**

  | Field               | Type                      | Nullable | Notes                                                                                                                                                                                                                        |
  | ------------------- | ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `id`                | `string`                  | no       | UUID of the transaction.                                                                                                                                                                                                     |
  | `type`              | `BusinessTransactionType` | no       | Transaction kind.                                                                                                                                                                                                            |
  | `amount`            | `string`                  | no       | Base amount in USD (decimal string, e.g. `"100.00"`).                                                                                                                                                                        |
  | `commission_rate`   | `string`                  | yes      | Commission rate snapshot (e.g. `"0.2500"`); `null` for types without commission.                                                                                                                                             |
  | `commission_amount` | `string`                  | yes      | `amount × commission_rate`; `null` when rate is absent.                                                                                                                                                                      |
  | `total_amount`      | `string`                  | no       | `amount + commission_amount` (equals `amount` when no commission).                                                                                                                                                           |
  | `status`            | `TransactionStatus`       | no       | Current processing status.                                                                                                                                                                                                   |
  | `note`              | `string`                  | yes      | Human-readable description; `null` when absent.                                                                                                                                                                              |
  | `payer_info`        | `PayerInfo`               | yes      | Payer snapshot stored at checkout creation; `null` for ledger entries that never went through Polar (e.g. `project_published`, `task_added`). See §1 shape.                                                                  |
  | `created_at`        | `ISO 8601`                | no       | Timestamp formatted in the caller's session timezone (`user_sessions.timezone`, captured at login from `x-timezone`); falls back to `UTC` when the session has no tz. Offset included, e.g. `2026-04-20T19:00:00.000+07:00`. |

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
