# Interview Question Bank API — Admin Endpoints

> **Source:** [`src/modules/consultant-application/controllers/admin-interview-question.controller.ts`](../../../src/modules/consultant-application/controllers/admin-interview-question.controller.ts)  
> **Base path:** `/api/v1/admin/interview-questions`  
> **Scope (applies to every endpoint):** Bearer auth, `@Roles(UserRole.ADMIN_PLATFORM)`. Non-admin callers receive `403`.  
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.  
> **Field-name convention:** request/response columns use **snake_case**.

---

## Overview

The question bank stores the manually curated pool of interview questions. When a consultant submits their profile, the system draws from this pool (plus AI-generated skill-based questions) to build a 30-question interview.

**Question composition per interview:**

| Type               | Count  | Source        | Admin-managed? |
| ------------------ | ------ | ------------- | -------------- |
| `COMMUNICATION`    | 10     | Question bank | Yes            |
| `SKILL_BASED`      | 15     | AI-generated  | No (read-only) |
| `SYSTEM_KNOWLEDGE` | 5      | Question bank | Yes            |
| **Total**          | **30** |               |                |

Only `COMMUNICATION` and `SYSTEM_KNOWLEDGE` questions can be created or edited through this API. `SKILL_BASED` questions are generated on-the-fly per consultant and are not stored in the question bank.

---

## Cross-cutting errors

| HTTP | `error_code`                   | When                                               |
| ---- | ------------------------------ | -------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing or invalid Bearer token.                   |
| 403  | (forbidden, no error_code)     | Caller is not `UserRole.ADMIN_PLATFORM`.           |
| 404  | `INTERVIEW_QUESTION_NOT_FOUND` | Question UUID does not exist.                      |
| 422  | (validation)                   | DTO shape failures or invalid UUID path parameter. |

---

## Endpoints

### 1. List questions

- **Endpoint:** `GET /admin/interview-questions`
- **Auth:** Bearer token required, admin only
- **Description:** Returns all questions in the bank. Supports optional filtering by `type` and `is_active`. Results are ordered by `display_order ASC`, then `created_at ASC`.

#### Query Parameters

| Parameter   | Type     | Required | Notes                                                           |
| ----------- | -------- | -------- | --------------------------------------------------------------- |
| `type`      | `string` | No       | `COMMUNICATION`, `SKILL_BASED`, or `SYSTEM_KNOWLEDGE`           |
| `is_active` | `string` | No       | `"true"` or `"false"`. Omit to return both active and inactive. |

#### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "COMMUNICATION",
      "content": "Describe a time when you had to explain a complex technical concept to a non-technical stakeholder.",
      "is_active": true,
      "display_order": 1,
      "created_at": "2026-05-10T09:00:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "type": "SYSTEM_KNOWLEDGE",
      "content": "What is the difference between synchronous and asynchronous communication in distributed systems?",
      "is_active": true,
      "display_order": 1,
      "created_at": "2026-05-10T09:05:00.000Z"
    }
  ],
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/interview-questions"
}
```

**Question fields:**

| Field           | Type             | Description                                                            |
| --------------- | ---------------- | ---------------------------------------------------------------------- |
| `id`            | `string`         | Question UUID                                                          |
| `type`          | `QuestionType`   | `COMMUNICATION`, `SKILL_BASED`, or `SYSTEM_KNOWLEDGE`                  |
| `content`       | `string`         | Question text                                                          |
| `is_active`     | `boolean`        | Whether this question is eligible for assignment in new interviews     |
| `display_order` | `number \| null` | Controls the order in which questions of the same type are prioritised |
| `created_at`    | `string`         | ISO-8601 creation timestamp                                            |

---

### 2. Create a question

- **Endpoint:** `POST /admin/interview-questions`
- **Auth:** Bearer token required, admin only
- **Description:** Creates a new `COMMUNICATION` or `SYSTEM_KNOWLEDGE` question. `SKILL_BASED` questions are AI-generated and cannot be created here.

#### Request Body

```json
{
  "type": "COMMUNICATION",
  "content": "Describe a time when you had to deliver difficult feedback to a colleague.",
  "display_order": 5
}
```

| Field           | Type     | Required | Constraints                                                              |
| --------------- | -------- | -------- | ------------------------------------------------------------------------ |
| `type`          | `string` | Yes      | `"COMMUNICATION"` or `"SYSTEM_KNOWLEDGE"` — `SKILL_BASED` rejected (400) |
| `content`       | `string` | Yes      | Non-empty question text                                                  |
| `display_order` | `number` | No       | Integer 1–999; controls pick order within the type                       |

#### Response 201

```json
{
  "status_code": 201,
  "message": "Interview question created.",
  "error_code": null,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "type": "COMMUNICATION",
    "content": "Describe a time when you had to deliver difficult feedback to a colleague.",
    "is_active": true,
    "display_order": 5,
    "created_at": "2026-05-10T12:00:00.000Z"
  },
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/interview-questions"
}
```

#### Errors

| HTTP | `error_code`                      | When                       |
| ---- | --------------------------------- | -------------------------- |
| 400  | `INTERVIEW_QUESTION_INVALID_TYPE` | `type` is `"SKILL_BASED"`. |
| 422  | (validation)                      | Missing or invalid fields. |

---

### 3. Update a question

- **Endpoint:** `PATCH /admin/interview-questions/:id`
- **Auth:** Bearer token required, admin only
- **Description:** Updates the `content` and/or `display_order` of an existing question. At least one field must be provided.

> **Important:** Updating a question's content does **not** retroactively change already-assigned `contentSnapshot` values. Each interview stores an immutable snapshot of the question text at assignment time.

#### Path Parameters

| Parameter | Type     | Description   |
| --------- | -------- | ------------- |
| `id`      | `string` | Question UUID |

#### Request Body

```json
{
  "content": "Describe a situation where you had to deliver difficult feedback to a colleague.",
  "display_order": 3
}
```

| Field           | Type     | Required | Constraints   |
| --------------- | -------- | -------- | ------------- |
| `content`       | `string` | No       | Non-empty     |
| `display_order` | `number` | No       | Integer 1–999 |

#### Response 200

```json
{
  "status_code": 200,
  "message": "Interview question updated.",
  "error_code": null,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "type": "COMMUNICATION",
    "content": "Describe a situation where you had to deliver difficult feedback to a colleague.",
    "is_active": true,
    "display_order": 3,
    "created_at": "2026-05-10T12:00:00.000Z"
  },
  "timestamp": "2026-05-10T13:00:00.000Z",
  "path": "/api/v1/admin/interview-questions/770e8400..."
}
```

#### Errors

| HTTP | `error_code`                   | When                                           |
| ---- | ------------------------------ | ---------------------------------------------- |
| 404  | `INTERVIEW_QUESTION_NOT_FOUND` | Question UUID does not exist.                  |
| 422  | (validation)                   | `content` empty; `display_order` out of range. |

---

### 4. Toggle active status

- **Endpoint:** `PATCH /admin/interview-questions/:id/active`
- **Auth:** Bearer token required, admin only
- **Description:** Toggles the `is_active` flag. Deactivated questions are excluded from new interview assignments but remain in already-assigned interviews (the `contentSnapshot` is immutable). Use this to retire outdated questions without deleting them.

#### Path Parameters

| Parameter | Type     | Description   |
| --------- | -------- | ------------- |
| `id`      | `string` | Question UUID |

#### Request Body

None.

#### Response 200

```json
{
  "status_code": 200,
  "message": "Interview question updated.",
  "error_code": null,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "type": "COMMUNICATION",
    "content": "Describe a situation where you had to deliver difficult feedback to a colleague.",
    "is_active": false,
    "display_order": 3,
    "created_at": "2026-05-10T12:00:00.000Z"
  },
  "timestamp": "2026-05-10T14:00:00.000Z",
  "path": "/api/v1/admin/interview-questions/770e8400.../active"
}
```

#### Errors

| HTTP | `error_code`                   | When                          |
| ---- | ------------------------------ | ----------------------------- |
| 404  | `INTERVIEW_QUESTION_NOT_FOUND` | Question UUID does not exist. |

---

## Minimum question counts

The interview assignment job requires at least the following active questions in the bank. If the active pool is smaller, the job assigns as many as exist (the interview may have fewer than 30 questions):

| Type               | Minimum recommended |
| ------------------ | ------------------- |
| `COMMUNICATION`    | 10                  |
| `SYSTEM_KNOWLEDGE` | 5                   |

Maintain more than the minimum to give the system headroom to vary question selection across different consultant cohorts.

---

## Error Codes

| `error_code`                      | HTTP | Description                                                    |
| --------------------------------- | ---- | -------------------------------------------------------------- |
| `INTERVIEW_QUESTION_NOT_FOUND`    | 404  | Question UUID does not exist in the bank                       |
| `INTERVIEW_QUESTION_INVALID_TYPE` | 400  | Attempted to create a `SKILL_BASED` question via the admin API |
