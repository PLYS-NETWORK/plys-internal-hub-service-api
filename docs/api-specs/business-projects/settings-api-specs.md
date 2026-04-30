# SettingsController — API Specs

> **Source:** [src/modules/business-projects/controllers/settings.controller.ts](../../../src/modules/business-projects/controllers/settings.controller.ts)
> **Base path:** `/projects/business/:id/settings`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).

## Cross-cutting errors

| HTTP | error_code                                    | When                                   |
| ---- | --------------------------------------------- | -------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.          |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile. |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.       |
| 422  | (validation)                                  | DTO shape failures.                    |

## Endpoints

### 1. Get project settings

- **Endpoint:** `GET /projects/business/:id/settings`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Response 200:** [`IProjectSettingsResponse`](../../../src/modules/business-projects/dto/responses/interfaces/project-settings.response.interface.ts) — `{ title, introduction, required_skills: [{ id, name }], max_consultants, interview_questions: [{ id, question_text, display_order, is_required }] }` (only active interview questions).
- **Errors:** cross-cutting only.

### 2. Update project metadata

- **Endpoint:** `PATCH /projects/business/:id/settings`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4)
- **Request body:** [`IUpdateProjectSettingsRequest`](../../../src/modules/business-projects/dto/requests/interfaces/update-project-settings.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `title` | `string` | no | |
  | `introduction` | `Record<string, unknown> \| null` | no | rich-text JSON |
  | `required_skills` | `string[]` | no | full replacement of skill IDs |
  | `max_consultants` | `number` | no | |
- **Response 200:** [`IProjectSummaryResponse`](../../../src/modules/business-projects/dto/responses/interfaces/project-summary.response.interface.ts)
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_CANNOT_BE_EDITED` | Project status is DONE or CANCELLED — thrown by [SettingsService.assertProjectEditable](../../../src/modules/business-projects/services/settings.service.ts). |
  | 422 | `PROJECT_SKILL_NOT_FOUND` | One or more skill IDs in `required_skills` do not exist. |

### 3. Create interview question

- **Endpoint:** `POST /projects/business/:id/settings/interview-questions`
- **Method:** `POST`
- **Path params:** `id` (UUID v4)
- **Request body:** [`IUpsertInterviewQuestionRequest`](../../../src/modules/business-projects/dto/requests/interfaces/upsert-interview-question.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `question_text` | `string` | yes (on create) | length 5–500 |
  | `display_order` | `number` | no | integer, ≥ 1 |
  | `is_required` | `boolean` | no | default `false` |
- **Response 201:** [`IInterviewQuestionResponse`](../../../src/modules/business-projects/dto/responses/interfaces/interview-question.response.interface.ts) — `{ id, question_text, display_order, is_required, created_at }`
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_CANNOT_BE_EDITED` | Project status is DONE or CANCELLED. |

### 4. Update interview question

- **Endpoint:** `PATCH /projects/business/:id/settings/interview-questions/:qid`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4), `qid` (UUID v4)
- **Request body:** [`UpdateInterviewQuestionDto`](../../../src/modules/business-projects/dto/requests/upsert-interview-question.dto.ts) — partial of `IUpsertInterviewQuestionRequest` (all fields optional).
- **Response 200:** [`IInterviewQuestionResponse`](../../../src/modules/business-projects/dto/responses/interfaces/interview-question.response.interface.ts)
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_CANNOT_BE_EDITED` | Project status is DONE or CANCELLED. |
  | 404 | `PROJECT_NOT_FOUND` | Interview question not found / soft-deleted. (Thrown via [SettingsService.findActiveQuestion](../../../src/modules/business-projects/services/settings.service.ts) — `messageKey: error.project.interview_question_not_found`, code `PROJECT_NOT_FOUND`.) |

### 5. Soft-delete interview question

- **Endpoint:** `DELETE /projects/business/:id/settings/interview-questions/:qid`
- **Method:** `DELETE`
- **Path params:** `id` (UUID v4), `qid` (UUID v4)
- **Response 204:** empty body. Application audit history is preserved (soft delete).
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_CANNOT_BE_EDITED` | Project status is DONE or CANCELLED. |
  | 404 | `PROJECT_NOT_FOUND` | Interview question not found / already deleted. |
