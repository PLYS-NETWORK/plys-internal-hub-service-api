# Admin — Onboarding Question Bank

> **Source:**
> [apps/internal-admin-service/src/modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller.ts](../../../../apps/internal-admin-service/src/modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller.ts)
> **Base path:** `/api/v1/admin/onboarding-questions`
> **Scope (applies to every endpoint):** Bearer auth, `RolesGuard`, `@Roles(UserRole.ADMIN_PLATFORM)`.
> **Field-name convention:** request/response payloads use **snake_case**.

Endpoints for managing the global onboarding question bank. Every consultant sees the **active**, non-soft-deleted set, in `position` order, when they call `GET /consultant/onboarding/questions` during Step 2 of onboarding.

## Question types

| Type       | `options` payload                                          | Notes                                                            |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `TEXT`     | omitted / empty                                            | Free-text answer.                                                |
| `RADIO`    | array of **≥ 2** `{ value, label }` with **unique values** | Single-choice. Consultant returns one `value`.                   |
| `CHECKBOX` | array of **≥ 2** `{ value, label }` with **unique values** | Multi-choice. Consultant returns a non-empty subset of `values`. |

The `value` is what gets persisted on every answer — keep it stable. The `label` is editable safely; existing answers still resolve via `value`.

## Cross-cutting errors

| HTTP | error_code                            | When                                                                                         |
| ---- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`                | Missing or invalid Bearer access token.                                                      |
| 403  | (role)                                | Token's role is not `ADMIN_PLATFORM`.                                                        |
| 404  | `ONBOARDING_QUESTION_NOT_FOUND`       | Question id does not exist.                                                                  |
| 422  | `ONBOARDING_QUESTION_INVALID_OPTIONS` | TEXT with options, or RADIO/CHECKBOX with < 2 options or duplicate `value`s.                 |
| 422  | `ONBOARDING_REORDER_SET_MISMATCH`     | Reorder body does not match the live active set (missing / extra / duplicate / inactive id). |
| 422  | (validation)                          | DTO failed validation (UUIDs, lengths, enum values).                                         |

---

## Endpoints

### 1. Create a question

- **Endpoint:** `POST /admin/onboarding-questions`
- **Body:** [`CreateOnboardingQuestionDto`](../../../../apps/internal-admin-service/src/modules/admin-onboarding-questions/dto/requests/create-onboarding-question.dto.ts)

  ```json
  {
    "type": "RADIO",
    "question": "Do you have prior remote-work experience?",
    "options": [
      { "value": "opt_yes_2y", "label": "Yes, more than 2 years" },
      { "value": "opt_yes_under_2", "label": "Yes, less than 2 years" },
      { "value": "opt_no", "label": "No" }
    ],
    "is_active": true
  }
  ```

  | Field       | Type   | Required | Notes                                                                                                                       |
  | ----------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------- |
  | `type`      | enum   | yes      | `TEXT \| RADIO \| CHECKBOX`.                                                                                                |
  | `question`  | string | yes      | 1–2000 chars.                                                                                                               |
  | `options`   | array  | no       | Required for RADIO/CHECKBOX (≥ 2 entries, unique `value`s). Must be omitted/empty for TEXT.                                 |
  | `is_active` | bool   | no       | Default `true`. When `true`, the new question is appended at `position = max(active) + 1`. When `false`, `position = null`. |

- **Response 201:** [`OnboardingQuestionResponseDto`](../../../../apps/internal-admin-service/src/modules/admin-onboarding-questions/dto/responses/onboarding-question-response.dto.ts)

  ```json
  {
    "id": "01H8E6...",
    "type": "RADIO",
    "question": "Do you have prior remote-work experience?",
    "options": [
      { "value": "opt_yes_2y", "label": "Yes, more than 2 years" },
      { "value": "opt_yes_under_2", "label": "Yes, less than 2 years" },
      { "value": "opt_no", "label": "No" }
    ],
    "position": 4,
    "is_active": true,
    "created_at": "2026-05-14T10:11:00.000Z",
    "updated_at": "2026-05-14T10:11:00.000Z"
  }
  ```

- **Errors:** cross-cutting only.

---

### 2. List active questions (no pagination)

- **Endpoint:** `GET /admin/onboarding-questions/active`
- **Response 200:** `OnboardingQuestionResponseDto[]` — every active, non-soft-deleted question ordered by `position` ASC.

  ```json
  [
    {
      "id": "01H8E5...",
      "type": "TEXT",
      "question": "...",
      "options": null,
      "position": 1,
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    },
    {
      "id": "01H8E6...",
      "type": "RADIO",
      "question": "...",
      "options": [
        /* ... */
      ],
      "position": 2,
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    },
    {
      "id": "01H8E7...",
      "type": "CHECKBOX",
      "question": "...",
      "options": [
        /* ... */
      ],
      "position": 3,
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
  ```

- **Errors:** cross-cutting only.

---

### 3. List inactive questions (paginated)

- **Endpoint:** `GET /admin/onboarding-questions/inactive`
- **Query params:** [`PageOptionsDto`](../../../../packages/common-nest/dto/page-options.dto.ts)

  | Field      | Type        | Default | Notes                    |
  | ---------- | ----------- | ------- | ------------------------ |
  | `page`     | int ≥ 1     | `1`     |                          |
  | `limit`    | int 1–100   | `20`    |                          |
  | `sort_by`  | string      | —       | Reserved for future use. |
  | `order_by` | `ASC\|DESC` | `DESC`  | Sort direction.          |

  Sort defaults to "most-recently updated".

- **Response 200:** [`PageDto<OnboardingQuestionResponseDto>`](../../../../packages/common-nest/dto/page.dto.ts)

  ```json
  {
    "data": [
      {
        "id": "01H8A1...",
        "type": "TEXT",
        "question": "Old question text",
        "options": null,
        "position": null,
        "is_active": false,
        "created_at": "...",
        "updated_at": "..."
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "itemCount": 3,
      "pageCount": 1,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  }
  ```

  Soft-deleted (deleted_at IS NOT NULL) rows are excluded.

- **Errors:** cross-cutting only.

---

### 4. Get a single question

- **Endpoint:** `GET /admin/onboarding-questions/:id`
- **Path params:** `id` (UUID v4)
- **Response 200:** `OnboardingQuestionResponseDto`. Includes soft-deleted rows so admin audit screens can still resolve historic answer snapshots.

- **Errors:**
  | HTTP | error_code | When |
  | ---- | -------------------------------- | ----------------------------- |
  | 404 | `ONBOARDING_QUESTION_NOT_FOUND` | Question id does not exist. |

---

### 5. Update a question

`type` is immutable. To change a question's type, soft-delete the row and recreate.

- **Endpoint:** `PATCH /admin/onboarding-questions/:id`
- **Path params:** `id` (UUID v4)
- **Body:** [`UpdateOnboardingQuestionDto`](../../../../apps/internal-admin-service/src/modules/admin-onboarding-questions/dto/requests/update-onboarding-question.dto.ts) — all fields optional.

  ```json
  {
    "question": "Updated question text",
    "options": [
      { "value": "opt_yes", "label": "Yes (updated label)" },
      { "value": "opt_no", "label": "No" }
    ]
  }
  ```

  | Field      | Type   | Required | Notes                                                                            |
  | ---------- | ------ | -------- | -------------------------------------------------------------------------------- |
  | `question` | string | no       | 1–2000 chars.                                                                    |
  | `options`  | array  | no       | Replaces options entirely. Same constraints as create — service rejects on TEXT. |

- **Response 200:** the refreshed `OnboardingQuestionResponseDto`.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | --------------------------------------- | --------------------------------------------------------------------- |
  | 404 | `ONBOARDING_QUESTION_NOT_FOUND` | Question id does not exist. |
  | 422 | `ONBOARDING_QUESTION_INVALID_OPTIONS` | Options shape incompatible with the question's current `type`. |

---

### 6. Toggle active / inactive

- **Endpoint:** `PATCH /admin/onboarding-questions/:id/active`
- **Path params:** `id` (UUID v4)
- **Body:** [`SetActiveFlagDto`](../../../../apps/internal-admin-service/src/modules/admin-onboarding-questions/dto/requests/set-active.dto.ts)

  ```json
  { "value": true }
  ```

- **Behaviour:**
  - **Activating** (`value: true`) — sets `position = max(active) + 1` and `is_active = true`.
  - **Deactivating** (`value: false`) — sets `position = null`, `is_active = false`, then compacts the remaining active positions to `1..N`.
  - No-op if the new value equals the current value.

- **Response 200:** the refreshed `OnboardingQuestionResponseDto`.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | -------------------------------- | ----------------------------- |
  | 404 | `ONBOARDING_QUESTION_NOT_FOUND` | Question id does not exist. |

---

### 7. Soft-delete a question

- **Endpoint:** `DELETE /admin/onboarding-questions/:id`
- **Path params:** `id` (UUID v4)
- **Behaviour:** sets `deleted_at = now`. If the question was active, the remaining active positions are compacted to `1..N`. Existing `consultant_onboarding_answers` rows continue to reference the soft-deleted question id (FK `RESTRICT`) and their `question_snapshot` is still rendered to admins.
- **Response 200:**

  ```json
  null
  ```

- **Errors:**
  | HTTP | error_code | When |
  | ---- | -------------------------------- | ----------------------------- |
  | 404 | `ONBOARDING_QUESTION_NOT_FOUND` | Question id does not exist. |

---

### 8. Bulk reorder the active set

Atomic, all-or-nothing reorder of the current active questions. The body MUST equal the full set of currently active, non-soft-deleted question ids — no duplicates, no missing ids, no inactive or soft-deleted ids.

- **Endpoint:** `POST /admin/onboarding-questions/reorder`
- **Body:** [`ReorderOnboardingQuestionsDto`](../../../../apps/internal-admin-service/src/modules/admin-onboarding-questions/dto/requests/reorder-onboarding-questions.dto.ts)

  ```json
  {
    "ordered_ids": ["01H8E7...", "01H8E5...", "01H8E6..."]
  }
  ```

- **Behaviour:** assigns positions `1..N` in a single transaction (every active row is briefly set to `position = null` to dodge the partial unique index, then re-numbered in order).
- **Response 200:** `OnboardingQuestionResponseDto[]` — the refreshed active list in the new order.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | 422 | `ONBOARDING_REORDER_SET_MISMATCH` | Duplicates, wrong size, or an id outside the live active set (e.g. inactive or soft-deleted). |
  | 422 | (validation) | `ordered_ids` missing, empty, or contains non-UUID values. |
