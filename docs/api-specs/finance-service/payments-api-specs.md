# PaymentsController — API Specs

> **Source:** [apps/finance-service/src/modules/payments/payments.controller.ts](../../../apps/finance-service/src/modules/payments/payments.controller.ts)
> **Base path:** `/api/v1/payments`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)` — enforced by global `JwtAuthGuard` and `RolesGuard`. No `@Platform` guard — these endpoints are **platform-agnostic**: the service routes to the correct strategy (`BusinessWithdrawStrategy` or `ConsultantWithdrawStrategy`) based on `activePlatform` from `RequestContextService`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).

## Cross-cutting errors (apply to all endpoints unless stated otherwise)

| HTTP | error_code            | When                                                                                    |
| ---- | --------------------- | --------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`   | Missing/invalid Bearer token (rejected by global `JwtAuthGuard`).                       |
| 400  | `GENERIC_BAD_REQUEST` | `activePlatform` in the JWT context is neither `BUSINESS` nor `CONSULTANT`.             |
| 422  | (validation)          | DTO shape failures from `class-validator` (missing/invalid fields, UUID, length, enum). |

---

## Endpoints

### 1. Initiate withdrawal

- **Endpoint:** `POST /payments/withdraw`
- **Method:** `POST`
- **Status:** `201 Created`
- **Request body:** [`ICreateWithdrawRequest`](../../../apps/finance-service/src/modules/payments/dto/requests/interfaces/create-withdraw.request.interface.ts)

  | Field         | Type     | Required | Constraints                      | Notes                                                                |
  | ------------- | -------- | -------- | -------------------------------- | -------------------------------------------------------------------- |
  | `amount`      | `number` | yes      | min `50`, max 2 decimal places   | Amount in USD to withdraw.                                           |
  | `success_url` | `string` | yes      | valid URL (`require_tld: false`) | Redirect URL after successful Stripe Connect onboarding or transfer. |
  | `cancel_url`  | `string` | yes      | valid URL (`require_tld: false`) | Redirect URL if onboarding or transfer is cancelled.                 |

- **Behaviour:**
  - If the caller's Stripe Connect account is **not yet linked** (`stripeConnectAccountId` is null): returns `is_connected: false` with an `onboarding_url` — no transaction is created, no balance is touched.
  - If Stripe is **connected**: validates that `accountBalance >= amount`, creates a `WITHDRAW` transaction, deducts the balance, and calls Stripe `createTransfer`. All DB writes + the transfer call run inside a single `withTransaction`. A successful transfer transitions the transaction to `COMPLETED`; a failed transfer throws `PAYMENT_TRANSFER_FAILED` and the entire DB transaction rolls back (balance and transaction row are both reverted).
  - On `COMPLETED`: fires a `WITHDRAW_COMPLETED` push notification (fire-and-forget).

- **Response 201:** [`IWithdrawResponse`](../../../apps/finance-service/src/modules/payments/dto/responses/interfaces/withdraw.response.interface.ts)

  | Field            | Type                        | Notes                                                                    |
  | ---------------- | --------------------------- | ------------------------------------------------------------------------ |
  | `is_connected`   | `boolean`                   | `true` when the platform profile has a linked Stripe Connect account.    |
  | `onboarding_url` | `string \| null`            | Stripe OAuth URL; only present when `is_connected = false`.              |
  | `transaction_id` | `string \| null`            | UUID of the created transaction; `null` when onboarding URL is returned. |
  | `status`         | `TransactionStatus \| null` | Always `completed` on success; `null` when no transaction was created.   |

- **Errors:**

  | HTTP | error_code                     | When                                                                |
  | ---- | ------------------------------ | ------------------------------------------------------------------- |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND`   | BUSINESS platform — no active business profile for the caller.      |
  | 404  | `CONSULTANT_PROFILE_NOT_FOUND` | CONSULTANT platform — no active consultant profile for the caller.  |
  | 422  | `PAYMENT_INSUFFICIENT_BALANCE` | `accountBalance < amount`.                                          |
  | 500  | `PAYMENT_TRANSFER_FAILED`      | Stripe `createTransfer` call failed; DB transaction is rolled back. |

---

### 2. Cancel pending withdrawal

- **Endpoint:** `POST /payments/withdraw/:transaction_id/cancel`
- **Method:** `POST`
- **Status:** `200 OK`
- **Path params:** `transaction_id` (UUID v4)

- **Pre-condition:** the transaction must be owned by the caller, have `type = WITHDRAW` (business) or `WITHDRAWAL` (consultant), and `status = PENDING`.

- **Behaviour (atomic — single DB transaction):**
  1. Loads the transaction and verifies ownership and status.
  2. Sets `status = FAILED`, `note = 'Cancelled by user — payment gateway closed'`.
  3. Restores `accountBalance += transaction.total_amount` on the caller's profile.
  4. Post-commit: fires a `WITHDRAW_REVERSED` push notification and sends a cancellation email (both fire-and-forget; failures do not fail the response).

- **Response 200:** [`ICancelWithdrawResponse`](../../../apps/finance-service/src/modules/payments/dto/responses/interfaces/cancel-withdraw.response.interface.ts)

  | Field             | Type                | Notes                                                                        |
  | ----------------- | ------------------- | ---------------------------------------------------------------------------- |
  | `transaction_id`  | `string`            | UUID of the cancelled transaction.                                           |
  | `status`          | `TransactionStatus` | Always `failed`.                                                             |
  | `restored_amount` | `string`            | Decimal string of the amount returned to `accountBalance` (e.g. `"250.00"`). |

- **Errors:**

  | HTTP | error_code                        | When                                                                  |
  | ---- | --------------------------------- | --------------------------------------------------------------------- |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND`      | BUSINESS platform — no active business profile.                       |
  | 404  | `CONSULTANT_PROFILE_NOT_FOUND`    | CONSULTANT platform — no active consultant profile.                   |
  | 404  | `PAYMENT_TRANSACTION_NOT_FOUND`   | No transaction with the given UUID exists.                            |
  | 403  | `PAYMENT_TRANSACTION_NOT_OWNED`   | Transaction exists but belongs to a different account.                |
  | 409  | `PAYMENT_TRANSACTION_NOT_PENDING` | Transaction `status ≠ PENDING` **or** `type ≠ WITHDRAW / WITHDRAWAL`. |
