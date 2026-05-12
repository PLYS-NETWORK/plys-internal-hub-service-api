# ContactController — API Specs

> **Source:** [src/modules/contact/contact.controller.ts](../../../src/modules/contact/contact.controller.ts)
> **Base path:** `/contact`
> **Scope:** `@Public()` — no auth. `@Throttle({ default: { limit: 5, ttl: 3_600_000 } })` — 5 submissions/hour per IP.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).

## Cross-cutting errors

| HTTP | error_code   | When                                                                            |
| ---- | ------------ | ------------------------------------------------------------------------------- |
| 422  | (validation) | DTO shape failures — missing/invalid fields, length violations, honeypot filled |
| 429  | (throttler)  | More than 5 submissions/hour from the same IP                                   |

## Endpoints

### 1. Submit a contact inquiry

- **Endpoint:** `POST /contact`
- **Method:** `POST`
- **Auth:** none
- **Request body:** [`ISubmitContactInquiryRequest`](../../../src/modules/contact/dto/requests/interfaces/submit-contact-inquiry.request.interface.ts)

  | Field     | Type                                             | Required | Notes                                  |
  | --------- | ------------------------------------------------ | -------- | -------------------------------------- |
  | `name`    | `string`                                         | yes      | length 1–120                           |
  | `email`   | `string`                                         | yes      | RFC-5321 email, length ≤ 254           |
  | `company` | `string`                                         | yes      | length 1–200                           |
  | `topic`   | `'sales' \| 'partnership' \| 'press' \| 'other'` | yes      | one of the four advertised channels    |
  | `message` | `string`                                         | yes      | length 10–5000                         |
  | `website` | `string`                                         | no       | **honeypot** — must be absent or empty |

- **Response 201:** [`IContactInquirySubmittedResponse`](../../../src/modules/contact/dto/responses/interfaces/contact-inquiry-submitted.response.interface.ts) — `{ id }`.
- **Side effects:**
  - Inserts a row into `contact_inquiries` with `status = 'received'`, `email_status = 'pending'`.
  - Fire-and-forget dispatch of two emails via Resend:
    - Internal notification → topic-appropriate inbox (`RESEND_CONTACT_INBOX_{SALES,PARTNERS,PRESS,SUPPORT}`), with `reply_to` = submitter email.
    - Acknowledgement → submitter email.
  - On success, `email_status` transitions `pending → sent`.
  - On failure, `email_status` transitions to `failed_notification` / `failed_acknowledgement` / `failed_both`. The HTTP response is unaffected.
- **Errors:** cross-cutting only.

## Topic → inbox routing

| Topic         | Env var                         | Default               |
| ------------- | ------------------------------- | --------------------- |
| `sales`       | `RESEND_CONTACT_INBOX_SALES`    | `sales@ployos.com`    |
| `partnership` | `RESEND_CONTACT_INBOX_PARTNERS` | `partners@ployos.com` |
| `press`       | `RESEND_CONTACT_INBOX_PRESS`    | `press@ployos.com`    |
| `other`       | `RESEND_CONTACT_INBOX_SUPPORT`  | `support@ployos.com`  |
